import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SceneMode } from './entities/scene-mode.entity';
import type { CreateSceneDto } from './dto/create-scene.dto';
import type { UpdateSceneDto } from './dto/update-scene.dto';

export interface SceneResponse {
  id: string;
  name: string;
  description: string | null;
  replyStyle: string;
  autoReply: boolean;
  isActive: boolean;
  rules: Record<string, unknown>;
  profileId: string | null;
  createdAt: string;
}

@Injectable()
export class SceneService {
  constructor(
    @InjectRepository(SceneMode)
    private readonly sceneRepo: Repository<SceneMode>,
  ) {}

  /** List all scenes for user. User_id isolated. */
  async findAll(userId: string): Promise<SceneResponse[]> {
    const list = await this.sceneRepo.find({
      where: { userId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return list.map((s) => this.toResponse(s));
  }

  /** Get one scene by id. User_id isolated. */
  async findOne(userId: string, sceneId: string): Promise<SceneMode | null> {
    return this.sceneRepo.findOne({
      where: { id: sceneId, userId },
    });
  }

  async findOneOrFail(userId: string, sceneId: string): Promise<SceneMode> {
    const scene = await this.findOne(userId, sceneId);
    if (!scene) throw new NotFoundException('NOT_FOUND');
    return scene;
  }

  /** Get current active scene for user. Only one can be active. */
  async findActive(userId: string): Promise<SceneResponse | null> {
    const scene = await this.sceneRepo.findOne({
      where: { userId, isActive: true },
    });
    return scene ? this.toResponse(scene) : null;
  }

  /** Create scene. User_id isolated. */
  async create(userId: string, dto: CreateSceneDto): Promise<SceneMode> {
    const scene = this.sceneRepo.create({
      userId,
      name: dto.name,
      description: dto.description ?? null,
      replyStyle: dto.replyStyle,
      autoReply: dto.autoReply,
      isActive: false,
      rules: (dto.rules as Record<string, unknown>) ?? {},
      profileId: dto.profileId ?? null,
      sortOrder: 0,
    });
    return this.sceneRepo.save(scene);
  }

  /** Update scene. User_id isolated. */
  async update(
    userId: string,
    sceneId: string,
    dto: UpdateSceneDto,
  ): Promise<SceneMode> {
    const scene = await this.findOneOrFail(userId, sceneId);
    if (dto.name !== undefined) scene.name = dto.name;
    if (dto.description !== undefined) scene.description = dto.description;
    if (dto.replyStyle !== undefined) scene.replyStyle = dto.replyStyle;
    if (dto.autoReply !== undefined) scene.autoReply = dto.autoReply;
    if (dto.rules !== undefined)
      scene.rules = dto.rules as unknown as Record<string, unknown>;
    if (dto.profileId !== undefined) scene.profileId = dto.profileId ?? null;
    return this.sceneRepo.save(scene);
  }

  /** Delete scene. User_id isolated. */
  async remove(userId: string, sceneId: string): Promise<void> {
    const scene = await this.findOneOrFail(userId, sceneId);
    await this.sceneRepo.remove(scene);
  }

  /**
   * Activate one scene and deactivate any other active scene for this user.
   * Only one scene is active at a time.
   */
  async activate(
    userId: string,
    sceneId: string,
  ): Promise<{ activatedScene: string; deactivatedScene: string | null }> {
    const scene = await this.findOneOrFail(userId, sceneId);
    const previouslyActive = await this.sceneRepo.findOne({
      where: { userId, isActive: true },
    });
    if (previouslyActive && previouslyActive.id !== sceneId) {
      previouslyActive.isActive = false;
      await this.sceneRepo.save(previouslyActive);
    }
    scene.isActive = true;
    await this.sceneRepo.save(scene);
    return {
      activatedScene: sceneId,
      deactivatedScene: previouslyActive?.id ?? null,
    };
  }

  /** Deactivate a scene. User_id isolated. */
  async deactivate(userId: string, sceneId: string): Promise<SceneMode> {
    const scene = await this.findOneOrFail(userId, sceneId);
    scene.isActive = false;
    return this.sceneRepo.save(scene);
  }

  private toResponse(s: SceneMode): SceneResponse {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      replyStyle: s.replyStyle,
      autoReply: s.autoReply,
      isActive: s.isActive,
      rules: (s.rules as Record<string, unknown>) ?? {},
      profileId: s.profileId,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
