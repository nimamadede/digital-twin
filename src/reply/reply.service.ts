import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReplyRecord } from './entities/reply-record.entity';
import { ContactService } from '../contact/contact.service';
import { StyleService } from '../style/style.service';
import { SceneService } from '../scene/scene.service';
import { AiEngineService, CandidateReply } from './services/ai-engine.service';
import { PromptBuilderService, ContextItem } from './services/prompt-builder.service';
import type { PaginatedResult } from '../common/dto/pagination.dto';
import type { GenerateReplyDto } from './dto/generate-reply.dto';
import type { ReviewReplyDto } from './dto/review-reply.dto';
import type { ReplyFeedbackDto } from './dto/reply-feedback.dto';
import type { ReplyHistoryQueryDto } from './dto/reply-history-query.dto';
import type { PendingReplyQueryDto } from './dto/pending-reply-query.dto';
import { UserSettings } from '../user/entities/user-settings.entity';

const PENDING_STATUS = 'pending';
const REVIEW_TIMEOUT_SECONDS = 300;

export interface GenerateReplyResult {
  replyId: string;
  candidates: CandidateReply[];
  profileUsed: string | null;
  sceneUsed: string | null;
}

export interface PendingReplyItem {
  id: string;
  incomingMessage: string;
  candidates: CandidateReply[];
  contact: { id: string; nickname: string; platform: string };
  createdAt: string;
  expiresAt: string | null;
}

export interface ReviewReplyResult {
  replyId: string;
  status: string;
  sentContent: string | null;
  sentAt: string | null;
}

export interface ReplyHistoryItem {
  id: string;
  incomingMessage: string;
  candidates: CandidateReply[];
  sentContent: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

@Injectable()
export class ReplyService {
  constructor(
    @InjectRepository(ReplyRecord)
    private readonly replyRepo: Repository<ReplyRecord>,
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
    private readonly contactService: ContactService,
    private readonly styleService: StyleService,
    private readonly sceneService: SceneService,
    private readonly aiEngine: AiEngineService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  /**
   * Generate candidate replies via AI and persist as pending. All operations scoped by userId.
   */
  async generate(
    userId: string,
    dto: GenerateReplyDto,
  ): Promise<GenerateReplyResult> {
    const contactId = dto.contactId;
    if (!contactId) {
      throw new BadRequestException('contactId is required');
    }
    const contact = await this.contactService.findOneOrFail(userId, contactId);

    let profileId = dto.profileId ?? contact.customReplyProfileId ?? null;
    if (!profileId) {
      const settings = await this.settingsRepo.findOne({
        where: { userId },
      });
      profileId = settings?.defaultProfileId ?? null;
    }
    let sceneId = dto.sceneId ?? null;
    if (!sceneId) {
      const activeScene = await this.sceneService.findActive(userId);
      sceneId = activeScene?.id ?? null;
    }

    let profileTraits: Record<string, unknown> = {};
    let sceneName: string | undefined;
    let sceneReplyStyle: string | undefined;
    if (profileId) {
      try {
        const profile = await this.styleService.findOneProfileOrFail(
          userId,
          profileId,
        );
        profileTraits = (profile.traits as Record<string, unknown>) ?? {};
      } catch {
        profileId = null;
      }
    }
    if (sceneId) {
      try {
        const scene = await this.sceneService.findOne(userId, sceneId);
        if (scene) {
          sceneName = scene.name;
          sceneReplyStyle = scene.replyStyle;
        } else {
          sceneId = null;
        }
      } catch {
        sceneId = null;
      }
    }

    const count = Math.min(dto.count ?? 3, 5);
    const context: ContextItem[] = (dto.context ?? []).map((c) => ({
      role: c.role,
      content: c.content,
      timestamp: c.timestamp,
    }));
    const candidates = await this.aiEngine.generateCandidates(
      {
        incomingMessage: dto.incomingMessage,
        context,
        profileTraits,
        sceneName,
        sceneReplyStyle,
        contactNickname: contact.nickname,
      },
      count,
    );

    const settings = await this.settingsRepo.findOne({ where: { userId } });
    const timeoutSeconds = settings?.reviewTimeout ?? REVIEW_TIMEOUT_SECONDS;
    const expiresAt = new Date(
      Date.now() + timeoutSeconds * 1000,
    );

    const record = this.replyRepo.create({
      userId,
      contactId,
      profileId,
      sceneId,
      incomingMessageId: null,
      incomingContent: dto.incomingMessage,
      candidates: candidates as unknown[],
      selectedIndex: null,
      sentContent: null,
      status: PENDING_STATUS,
      feedbackRating: null,
      feedbackTag: null,
      feedbackComment: null,
      reviewedAt: null,
      sentAt: null,
      expiresAt,
    });
    const saved = await this.replyRepo.save(record);

    return {
      replyId: saved.id,
      candidates,
      profileUsed: profileId,
      sceneUsed: sceneId,
    };
  }

  /**
   * List pending replies with user_id isolation. Paginated.
   */
  async getPending(
    userId: string,
    query: PendingReplyQueryDto,
  ): Promise<PaginatedResult<PendingReplyItem>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const qb = this.replyRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.contact', 'contact')
      .where('r.userId = :userId', { userId })
      .andWhere('r.status = :status', { status: PENDING_STATUS })
      .orderBy('r.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (query.contactId) {
      qb.andWhere('r.contactId = :contactId', {
        contactId: query.contactId,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((r) => ({
        id: r.id,
        incomingMessage: r.incomingContent,
        candidates: (r.candidates as CandidateReply[]) ?? [],
        contact: {
          id: r.contact.id,
          nickname: r.contact.nickname,
          platform: r.contact.platform,
        },
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Find one reply by id with user_id isolation.
   */
  async findOneOrFail(userId: string, replyId: string): Promise<ReplyRecord> {
    const record = await this.replyRepo.findOne({
      where: { id: replyId, userId },
    });
    if (!record) throw new NotFoundException('NOT_FOUND');
    return record;
  }

  /**
   * Review reply: approve (select candidate), reject, or edit. Enforces user_id isolation.
   */
  async review(
    userId: string,
    replyId: string,
    dto: ReviewReplyDto,
  ): Promise<ReviewReplyResult> {
    const record = await this.findOneOrFail(userId, replyId);
    if (record.status !== PENDING_STATUS) {
      throw new BadRequestException('Reply is not pending review');
    }

    const now = new Date();
    const candidates = (record.candidates as CandidateReply[]) ?? [];

    if (dto.action === 'approve') {
      if (
        typeof dto.selectedIndex !== 'number' ||
        dto.selectedIndex < 0 ||
        dto.selectedIndex >= candidates.length
      ) {
        throw new BadRequestException('Invalid selectedIndex for approve');
      }
      const sentContent = candidates[dto.selectedIndex].content;
      record.selectedIndex = dto.selectedIndex;
      record.sentContent = sentContent;
      record.status = 'sent';
      record.reviewedAt = now;
      record.sentAt = now;
    } else if (dto.action === 'reject') {
      record.status = 'rejected';
      record.reviewedAt = now;
    } else if (dto.action === 'edit') {
      if (!dto.editedContent?.trim()) {
        throw new BadRequestException('editedContent required for edit');
      }
      record.sentContent = dto.editedContent.trim();
      record.status = 'edited';
      record.reviewedAt = now;
      record.sentAt = now;
    } else {
      throw new BadRequestException('Invalid action');
    }

    await this.replyRepo.save(record);

    return {
      replyId: record.id,
      status: record.status,
      sentContent: record.sentContent,
      sentAt: record.sentAt?.toISOString() ?? null,
    };
  }

  /**
   * Submit feedback for a reply. Enforces user_id isolation.
   */
  async submitFeedback(
    userId: string,
    replyId: string,
    dto: ReplyFeedbackDto,
  ): Promise<void> {
    const record = await this.findOneOrFail(userId, replyId);
    record.feedbackRating = dto.rating;
    record.feedbackTag = dto.feedback ?? null;
    record.feedbackComment = dto.comment ?? null;
    await this.replyRepo.save(record);
  }

  /**
   * Get reply history with filters. All queries filter by userId.
   */
  async getHistory(
    userId: string,
    query: ReplyHistoryQueryDto,
  ): Promise<PaginatedResult<ReplyHistoryItem>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const qb = this.replyRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .orderBy('r.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (query.contactId) {
      qb.andWhere('r.contactId = :contactId', {
        contactId: query.contactId,
      });
    }
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }
    if (query.startDate) {
      qb.andWhere('r.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query.endDate) {
      qb.andWhere('r.createdAt <= :endDate', { endDate: query.endDate });
    }

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((r) => ({
        id: r.id,
        incomingMessage: r.incomingContent,
        candidates: (r.candidates as CandidateReply[]) ?? [],
        sentContent: r.sentContent,
        status: r.status,
        sentAt: r.sentAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
