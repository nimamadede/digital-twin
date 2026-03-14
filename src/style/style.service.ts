import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StorageService } from '../storage/storage.service';
import { StyleProfile } from './entities/style-profile.entity';
import { StyleSample } from './entities/style-sample.entity';
import { StyleTask } from './entities/style-task.entity';
import { VectorStoreService } from './services/vector-store.service';
import type { PaginatedResult } from '../common/dto/pagination.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { ProfileQueryDto } from './dto/profile-query.dto';

export const STYLE_QUEUE_NAME = 'style-analysis';

export interface UploadStyleResult {
  fileId: string;
  fileName: string;
  fileSize: number;
  taskId: string;
  status: string;
}

export interface TaskStatusResult {
  taskId: string;
  status: string;
  progress: number;
  startedAt: string | null;
  estimatedCompletion: string | null;
}

export interface ProfileListItem {
  id: string;
  name: string;
  description: string | null;
  traits: Record<string, unknown>;
  sampleCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileDetailResult extends ProfileListItem {
  samples: Array<{
    id: string;
    content: string;
    platform: string;
    createdAt: string;
  }>;
}

@Injectable()
export class StyleService {
  constructor(
    @InjectRepository(StyleProfile)
    private readonly profileRepo: Repository<StyleProfile>,
    @InjectRepository(StyleSample)
    private readonly sampleRepo: Repository<StyleSample>,
    @InjectRepository(StyleTask)
    private readonly taskRepo: Repository<StyleTask>,
    private readonly storageService: StorageService,
    private readonly vectorStoreService: VectorStoreService,
    @InjectQueue(STYLE_QUEUE_NAME)
    private readonly styleQueue: Queue,
  ) {}

  /**
   * Upload chat file, create draft profile + pending task, enqueue analysis. All scoped by userId.
   */
  async upload(
    userId: string,
    file: Express.Multer.File,
    platform: string,
    description?: string,
  ): Promise<UploadStyleResult> {
    const allowed = ['.txt', '.csv', '.json'];
    const ext = file.originalname?.toLowerCase().includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase()
      : '';
    if (!allowed.includes(ext)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: .txt, .csv, .json',
      );
    }

    const uploadResult = await this.storageService.upload(
      userId,
      file,
      'style_analysis',
    );

    const profile = this.profileRepo.create({
      userId,
      name: description?.trim() || file.originalname?.slice(0, 80) || '未命名',
      description: description?.trim() || null,
      traits: {},
      status: 'draft',
      sampleCount: 0,
    });
    const savedProfile = await this.profileRepo.save(profile);

    const task = this.taskRepo.create({
      userId,
      profileId: savedProfile.id,
      fileId: uploadResult.id,
      status: 'pending',
      progress: 0,
    });
    const savedTask = await this.taskRepo.save(task);

    await this.styleQueue.add(
      'analyze',
      {
        taskId: savedTask.id,
        profileId: savedProfile.id,
        fileId: uploadResult.id,
        userId,
        platform,
        description,
      },
      { jobId: savedTask.id },
    );

    return {
      fileId: uploadResult.id,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      taskId: savedTask.id,
      status: 'pending',
    };
  }

  /**
   * Get task status. Enforces user_id isolation.
   */
  async getTaskStatus(userId: string, taskId: string): Promise<TaskStatusResult> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, userId },
    });
    if (!task) throw new NotFoundException('Task not found');

    let estimatedCompletion: string | null = null;
    if (task.startedAt && task.status === 'processing') {
      const eta = new Date(task.startedAt.getTime() + 60 * 1000);
      estimatedCompletion = eta.toISOString();
    }

    return {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      startedAt: task.startedAt?.toISOString() ?? null,
      estimatedCompletion,
    };
  }

  /**
   * List profiles with pagination. All queries filter by userId.
   */
  async listProfiles(
    userId: string,
    query: ProfileQueryDto,
  ): Promise<PaginatedResult<ProfileListItem>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.profileRepo.findAndCount({
      where: { userId },
      order: { updatedAt: 'DESC' },
      skip,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);
    return {
      items: items.map((p) => this.toListItem(p)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get profile detail with samples. Enforces user_id isolation.
   */
  async getProfileDetail(
    userId: string,
    profileId: string,
  ): Promise<ProfileDetailResult> {
    const profile = await this.profileRepo.findOne({
      where: { id: profileId, userId },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const samples = await this.sampleRepo.find({
      where: { profileId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const list = this.toListItem(profile);
    return {
      ...list,
      samples: samples.map((s) => ({
        id: s.id,
        content: s.content,
        platform: s.platform,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Update profile. Enforces user_id isolation.
   */
  async updateProfile(
    userId: string,
    profileId: string,
    dto: UpdateProfileDto,
  ): Promise<StyleProfile> {
    const profile = await this.findOneProfileOrFail(userId, profileId);
    if (dto.name !== undefined) profile.name = dto.name;
    if (dto.description !== undefined) profile.description = dto.description;
    if (dto.traits !== undefined) {
      profile.traits = { ...profile.traits, ...dto.traits };
    }
    return this.profileRepo.save(profile);
  }

  /**
   * Delete profile and Qdrant collection. Enforces user_id isolation.
   */
  async deleteProfile(userId: string, profileId: string): Promise<void> {
    const profile = await this.findOneProfileOrFail(userId, profileId);
    await this.vectorStoreService.deleteCollection(profileId);
    await this.profileRepo.remove(profile);
  }

  /**
   * Create reanalyze task from existing samples. Enforces user_id isolation.
   */
  async reanalyze(userId: string, profileId: string): Promise<{ taskId: string }> {
    const profile = await this.findOneProfileOrFail(userId, profileId);
    const task = this.taskRepo.create({
      userId,
      profileId: profile.id,
      fileId: null,
      status: 'pending',
      progress: 0,
    });
    const savedTask = await this.taskRepo.save(task);

    await this.styleQueue.add(
      'analyze',
      {
        taskId: savedTask.id,
        profileId: profile.id,
        userId,
        reanalyze: true,
      },
      { jobId: savedTask.id },
    );

    return { taskId: savedTask.id };
  }

  async findOneProfileOrFail(userId: string, profileId: string): Promise<StyleProfile> {
    const profile = await this.profileRepo.findOne({
      where: { id: profileId, userId },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  private toListItem(p: StyleProfile): ProfileListItem {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      traits: p.traits ?? {},
      sampleCount: p.sampleCount,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
