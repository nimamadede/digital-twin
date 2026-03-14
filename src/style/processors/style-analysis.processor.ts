import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageService } from '../../storage/storage.service';
import { StyleProfile } from '../entities/style-profile.entity';
import { StyleSample } from '../entities/style-sample.entity';
import { StyleTask } from '../entities/style-task.entity';
import { StyleAnalyzerService } from '../services/style-analyzer.service';
import {
  VectorStoreService,
  STYLE_VECTOR_DIMENSION,
} from '../services/vector-store.service';
import { STYLE_QUEUE_NAME } from '../style.service';

export interface StyleAnalysisJobPayload {
  taskId: string;
  profileId: string;
  fileId?: string;
  userId: string;
  platform?: string;
  description?: string;
  reanalyze?: boolean;
}

@Processor(STYLE_QUEUE_NAME, { concurrency: 2 })
export class StyleAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(StyleAnalysisProcessor.name);

  constructor(
    @InjectRepository(StyleTask)
    private readonly taskRepo: Repository<StyleTask>,
    @InjectRepository(StyleProfile)
    private readonly profileRepo: Repository<StyleProfile>,
    @InjectRepository(StyleSample)
    private readonly sampleRepo: Repository<StyleSample>,
    private readonly storageService: StorageService,
    private readonly styleAnalyzer: StyleAnalyzerService,
    private readonly vectorStore: VectorStoreService,
  ) {
    super();
  }

  async process(job: Job<StyleAnalysisJobPayload>): Promise<void> {
    const { taskId, profileId, userId, fileId, platform, reanalyze } = job.data;

    const task = await this.taskRepo.findOne({
      where: { id: taskId, userId },
    });
    if (!task || task.status !== 'pending') {
      this.logger.warn(`Task ${taskId} not found or not pending, skip`);
      return;
    }

    await this.taskRepo.update(
      { id: taskId, userId },
      { status: 'processing', progress: 5, startedAt: new Date() },
    );
    await this.profileRepo.update(
      { id: profileId, userId },
      { status: 'analyzing' },
    );

    try {
      let samples: Array<{ content: string; platform: string }>;

      if (reanalyze) {
        const existing = await this.sampleRepo.find({
          where: { profileId },
          order: { createdAt: 'ASC' },
        });
        samples = existing.map((s) => ({
          content: s.content,
          platform: s.platform,
        }));
      } else if (fileId) {
        const buffer = await this.storageService.getFileBuffer(userId, fileId);
        samples = this.parseChatFile(buffer, platform ?? 'other');
        if (!samples.length) {
          throw new Error('No valid chat samples parsed from file');
        }
        await this.taskRepo.update(
          { id: taskId, userId },
          { progress: 30 },
        );

        const profile = await this.profileRepo.findOne({
          where: { id: profileId, userId },
        });
        if (!profile) throw new Error('Profile not found');

        const toInsert = samples.map((s) =>
          this.sampleRepo.create({
            profileId,
            content: s.content,
            platform: s.platform,
            role: 'user',
          }),
        );
        await this.sampleRepo.save(toInsert);
      } else {
        throw new Error('Either fileId or reanalyze must be set');
      }

      await this.taskRepo.update(
        { id: taskId, userId },
        { progress: 60 },
      );

      const traits = this.styleAnalyzer.analyze(samples);
      const profile = await this.profileRepo.findOne({
        where: { id: profileId, userId },
      });
      if (!profile) throw new Error('Profile not found');

      const sampleCount = await this.sampleRepo.count({ where: { profileId } });
      let collectionName: string | null = null;
      try {
        collectionName = await this.vectorStore.ensureCollection(profileId);
        const samplesForVector = await this.sampleRepo.find({
          where: { profileId },
          take: 500,
        });
        const points = samplesForVector.map((s) => ({
          id: s.id,
          vector: this.styleAnalyzer.embed(s.content, STYLE_VECTOR_DIMENSION),
          payload: { platform: s.platform },
        }));
        await this.vectorStore.upsert(profileId, points);
      } catch (vecErr) {
        this.logger.warn(
          `Vector store skipped for profile ${profileId}: ${vecErr instanceof Error ? vecErr.message : vecErr}`,
        );
      }

      profile.traits = { ...traits } as Record<string, unknown>;
      profile.sampleCount = sampleCount;
      profile.status = 'active';
      profile.vectorCollection = collectionName;
      await this.profileRepo.save(profile);

      await this.taskRepo.update(
        { id: taskId, userId },
        {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          errorMessage: null,
        },
      );
      this.logger.log(`Task ${taskId} completed for profile ${profileId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Task ${taskId} failed: ${message}`);
      await this.taskRepo.update(
        { id: taskId, userId },
        {
          status: 'failed',
          errorMessage: message,
          completedAt: new Date(),
        },
      );
      await this.profileRepo.update(
        { id: profileId, userId },
        { status: 'draft' },
      );
    }
  }

  /**
   * Parse chat file content into { content, platform }[].
   */
  private parseChatFile(
    buffer: Buffer,
    platform: string,
  ): Array<{ content: string; platform: string }> {
    const text = buffer.toString('utf-8').trim();
    if (!text) return [];

    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            const content =
              typeof item === 'string'
                ? item
                : (item as Record<string, unknown>)?.content ??
                  (item as Record<string, unknown>)?.text ??
                  (item as Record<string, unknown>)?.message;
            return typeof content === 'string' ? content.trim() : null;
          })
          .filter((c): c is string => Boolean(c))
          .map((content) => ({ content, platform }));
      }
      if (parsed && typeof parsed === 'object' && 'messages' in parsed) {
        const messages = (parsed as { messages: unknown[] }).messages;
        return (messages || [])
          .map((m) =>
            typeof m === 'string'
              ? m
              : (m as Record<string, unknown>)?.content ??
                (m as Record<string, unknown>)?.text,
          )
          .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
          .map((content) => ({ content: content.trim(), platform }));
      }
    } catch {
      // not JSON, fall through to line-based
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((content) => ({ content, platform }));
  }
}
