import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutingLog } from './entities/routing-log.entity';
import { RoutingRule } from './entities/routing-rule.entity';
import { RuleEngineService, type RuleMatchContext } from './services/rule-engine.service';
import { RoutingStatsService } from './services/routing-stats.service';
import { RouteExecutorService } from './services/route-executor.service';
import { ContactService } from '../contact/contact.service';
import { SceneService } from '../scene/scene.service';
import { MessageService } from '../message/message.service';
import { ReplyService } from '../reply/reply.service';
import { PlatformService } from '../platform/platform.service';
import { NotificationGateway } from '../notification/gateways/notification.gateway';
import type { RoutingLogQueryDto } from './dto/routing-log-query.dto';
import type { InboundMessageDto } from './dto/inbound-message.dto';
import type { CreateRoutingRuleDto } from './dto/create-routing-rule.dto';
import type { UpdateRoutingRuleDto } from './dto/update-routing-rule.dto';
import type { SimulateRouteDto } from './dto/simulate-route.dto';
import type { RouterStatsQueryDto } from './dto/stats-query.dto';
import type { PaginatedResult } from '../common/dto/pagination.dto';

/** In-memory pause state per user. For multi-instance, use Redis. */
const pausedByUser = new Map<string, boolean>();

@Injectable()
export class MessageRouterService {
  private readonly logger = new Logger(MessageRouterService.name);

  constructor(
    @InjectRepository(RoutingLog)
    private readonly logRepo: Repository<RoutingLog>,
    @InjectRepository(RoutingRule)
    private readonly ruleRepo: Repository<RoutingRule>,
    private readonly ruleEngine: RuleEngineService,
    private readonly routingStats: RoutingStatsService,
    private readonly routeExecutor: RouteExecutorService,
    private readonly contactService: ContactService,
    private readonly sceneService: SceneService,
    private readonly messageService: MessageService,
    private readonly replyService: ReplyService,
    private readonly platformService: PlatformService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  isPaused(userId: string): boolean {
    return pausedByUser.get(userId) ?? false;
  }

  pause(userId: string): { status: 'paused'; pausedAt: string; pendingMessages: number } {
    pausedByUser.set(userId, true);
    return {
      status: 'paused',
      pausedAt: new Date().toISOString(),
      pendingMessages: 0,
    };
  }

  resume(userId: string): { status: 'running'; resumedAt: string } {
    pausedByUser.set(userId, false);
    return {
      status: 'running',
      resumedAt: new Date().toISOString(),
    };
  }

  async getDashboard(userId: string) {
    const status = this.isPaused(userId) ? 'paused' as const : 'running' as const;
    const activeScene = await this.sceneService.findActive(userId);
    return this.routingStats.getDashboard(
      userId,
      status,
      activeScene ? { id: activeScene.id, name: activeScene.name } : null,
    );
  }

  async getLogs(
    userId: string,
    query: RoutingLogQueryDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const qb = this.logRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.contact', 'contact')
      .leftJoinAndSelect('log.scene', 'scene')
      .where('log.userId = :userId', { userId })
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (query.contactId) {
      qb.andWhere('log.contactId = :contactId', { contactId: query.contactId });
    }
    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.sceneId) {
      qb.andWhere('log.sceneId = :sceneId', { sceneId: query.sceneId });
    }
    if (query.startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: query.endDate });
    }

    const [logs, total] = await qb.getManyAndCount();
    const items = logs.map((log) => this.toLogItem(log));
    const totalPages = Math.ceil(total / pageSize);
    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getLogById(userId: string, logId: string): Promise<Record<string, unknown>> {
    const log = await this.logRepo.findOne({
      where: { id: logId, userId },
      relations: ['contact', 'scene'],
    });
    if (!log) throw new NotFoundException('NOT_FOUND');
    return this.toLogItem(log);
  }

  async getRules(userId: string): Promise<Record<string, unknown>[]> {
    const rules = await this.ruleRepo.find({
      where: { userId },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
    return rules.map((r) => this.toRuleItem(r));
  }

  async createRule(userId: string, dto: CreateRoutingRuleDto): Promise<{ id: string; name: string; priority: number }> {
    const rule = this.ruleRepo.create({
      userId,
      name: dto.name,
      priority: dto.priority,
      isEnabled: dto.isEnabled,
      isSystem: false,
      type: dto.type,
      conditions: dto.conditions as unknown as RoutingRule['conditions'],
      action: dto.action,
      actionConfig: (dto.actionConfig ?? {}) as unknown as RoutingRule['actionConfig'],
    });
    const saved = await this.ruleRepo.save(rule);
    return { id: saved.id, name: saved.name, priority: saved.priority };
  }

  async updateRule(userId: string, ruleId: string, dto: UpdateRoutingRuleDto): Promise<RoutingRule> {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId, userId } });
    if (!rule) throw new NotFoundException('NOT_FOUND');
    if (dto.name !== undefined) rule.name = dto.name;
    if (dto.priority !== undefined) rule.priority = dto.priority;
    if (dto.isEnabled !== undefined) rule.isEnabled = dto.isEnabled;
    if (dto.type !== undefined) rule.type = dto.type;
    if (dto.conditions !== undefined) rule.conditions = dto.conditions as unknown as RoutingRule['conditions'];
    if (dto.action !== undefined) rule.action = dto.action;
    if (dto.actionConfig !== undefined) rule.actionConfig = dto.actionConfig as unknown as RoutingRule['actionConfig'];
    return this.ruleRepo.save(rule);
  }

  async deleteRule(userId: string, ruleId: string): Promise<void> {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId, userId } });
    if (!rule) throw new NotFoundException('NOT_FOUND');
    if (rule.isSystem) throw new BadRequestException('System rule cannot be deleted');
    await this.ruleRepo.remove(rule);
  }

  async reorderRules(userId: string, orderedIds: string[]): Promise<void> {
    const rules = await this.ruleRepo.find({
      where: { userId },
    });
    const byId = new Map(rules.map((r) => [r.id, r]));
    let priority = 1;
    for (const id of orderedIds) {
      const rule = byId.get(id);
      if (rule) {
        rule.priority = priority++;
        await this.ruleRepo.save(rule);
      }
    }
  }

  async simulate(userId: string, dto: SimulateRouteDto): Promise<{
    finalAction: string;
    matchedRuleId: string | null;
    matchedRuleName: string | null;
    sceneId: string | null;
    sceneName: string | null;
    profileId: string | null;
    steps: Array<{ step: string; result: string; detail?: unknown }>;
  }> {
    const contact = await this.contactService.findOneOrFail(userId, dto.contactId);
    const rules = await this.ruleRepo.find({
      where: { userId },
      order: { priority: 'ASC' },
    });
    const activeScene = await this.sceneService.findActive(userId);
    const simTime = dto.simulateTime ? new Date(dto.simulateTime) : new Date();

    const context: RuleMatchContext = {
      contact: {
        level: contact.level,
        isWhitelist: contact.isWhitelist,
        isBlacklist: contact.isBlacklist,
        tags: contact.tags ?? [],
      },
      message: {
        content: dto.incomingMessage,
        msgType: dto.msgType ?? 'text',
        isGroup: false,
        length: dto.incomingMessage.length,
      },
      platform: dto.platform,
      time: simTime,
    };

    const matchResult = this.ruleEngine.matchRule(rules, context);
    const steps: Array<{ step: string; result: string; detail?: unknown }> = [
      {
        step: 'contact_lookup',
        result: 'found',
        detail: { level: contact.level, isWhitelist: contact.isWhitelist, isBlacklist: contact.isBlacklist },
      },
    ];

    if (matchResult) {
      for (const s of matchResult.stepDetails) {
        steps.push({ step: s.step, result: s.result, detail: s.detail });
      }
      steps.push({
        step: 'scene_match',
        result: activeScene?.name ?? 'none',
        detail: activeScene
          ? { timeMatch: true, weekdayMatch: true }
          : undefined,
      });
      const actionConfig = matchResult.rule.actionConfig as { autoApprove?: boolean };
      steps.push({
        step: 'final_decision',
        result: `${matchResult.rule.action}${actionConfig?.autoApprove ? ' with auto_approve' : ''}`,
      });
      return {
        finalAction: matchResult.rule.action,
        matchedRuleId: matchResult.rule.id,
        matchedRuleName: matchResult.rule.name,
        sceneId: activeScene?.id ?? null,
        sceneName: activeScene?.name ?? null,
        profileId: activeScene?.profileId ?? null,
        steps,
      };
    }

    steps.push({ step: 'rule_evaluate', result: 'no_match' });
    steps.push({ step: 'scene_match', result: activeScene?.name ?? 'none' });
    steps.push({ step: 'final_decision', result: 'manual' });
    return {
      finalAction: 'manual',
      matchedRuleId: null,
      matchedRuleName: null,
      sceneId: activeScene?.id ?? null,
      sceneName: activeScene?.name ?? null,
      profileId: activeScene?.profileId ?? null,
      steps,
    };
  }

  async getStats(userId: string, query: RouterStatsQueryDto) {
    const period = query.period ?? 'day';
    return this.routingStats.getStats(
      userId,
      period,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * Update routing log with reply result (after generate + send). User_id isolated.
   */
  async updateLogReply(
    userId: string,
    logId: string,
    replyRecordId: string,
    replySentContent: string,
  ): Promise<void> {
    const log = await this.logRepo.findOne({
      where: { id: logId, userId },
    });
    if (!log) throw new NotFoundException('Routing log not found');
    log.replyRecordId = replyRecordId;
    log.replySentContent = replySentContent;
    await this.logRepo.save(log);
  }

  /**
   * Process inbound platform message: contact lookup -> create message -> route -> generate reply (if auto_reply/pending_review) -> send or pending.
   * For self-test and for future connector webhook integration.
   */
  async processInboundMessage(
    userId: string,
    dto: InboundMessageDto,
  ): Promise<{
    action: string;
    messageId: string;
    routingLogId: string;
    contactId: string;
    replyRecordId?: string;
    sentContent?: string;
  }> {
    const platform = dto.platform;
    const content = dto.content.trim();
    const msgType = dto.msgType ?? 'text';
    const isGroup = dto.isGroup ?? false;

    const contact = await this.contactService.findOrCreateByPlatform(
      userId,
      platform,
      dto.platformContactId,
      dto.nickname,
    );

    const message = await this.messageService.createIncoming(
      userId,
      contact.id,
      platform,
      content,
      msgType,
    );

    this.notificationGateway.emitMessageReceived(userId, {
      messageId: message.id,
      contactId: contact.id,
      contactNickname: contact.nickname,
      content,
      platform,
      msgType,
      timestamp: message.createdAt.toISOString(),
    });

    const rules = await this.ruleRepo.find({
      where: { userId },
      order: { priority: 'ASC' },
    });
    const activeScene = await this.sceneService.findActive(userId);
    const scenePayload = activeScene
      ? { id: activeScene.id, name: activeScene.name, profileId: activeScene.profileId }
      : null;
    const isPaused = this.isPaused(userId);

    const routeCtx: Parameters<RouteExecutorService['execute']>[0] = {
      userId,
      messageId: message.id,
      contactId: contact.id,
      contactNickname: contact.nickname,
      platform,
      incomingContent: content,
      contact: {
        level: contact.level,
        isWhitelist: contact.isWhitelist,
        isBlacklist: contact.isBlacklist,
        tags: contact.tags ?? [],
      },
      message: { msgType, isGroup, length: content.length },
    };

    const routeResult = await this.routeExecutor.execute(
      routeCtx,
      rules,
      scenePayload,
      isPaused,
    );

    const out: {
      action: string;
      messageId: string;
      routingLogId: string;
      contactId: string;
      replyRecordId?: string;
      sentContent?: string;
    } = {
      action: routeResult.action,
      messageId: message.id,
      routingLogId: routeResult.routingLogId,
      contactId: contact.id,
    };

    if (routeResult.action === 'auto_reply') {
      try {
        const gen = await this.replyService.generate(userId, {
          incomingMessage: content,
          contactId: contact.id,
          profileId: routeResult.profileId ?? undefined,
          sceneId: routeResult.sceneId ?? undefined,
          count: 1,
        });
        const review = await this.replyService.review(userId, gen.replyId, {
          action: 'approve',
          selectedIndex: 0,
        });
        if (review.sentContent) {
          await this.messageService.createOutgoing(
            userId,
            contact.id,
            platform,
            review.sentContent,
            gen.replyId,
            true,
          );
          await this.platformService.sendOutboundText(
            userId,
            platform,
            dto.platformContactId,
            review.sentContent,
          );
          await this.updateLogReply(
            userId,
            routeResult.routingLogId,
            gen.replyId,
            review.sentContent,
          );
          this.notificationGateway.emitReplySent(userId, {
            replyId: gen.replyId,
            status: review.status,
            sentContent: review.sentContent,
            sentAt: review.sentAt,
          });
          out.replyRecordId = gen.replyId;
          out.sentContent = review.sentContent;
        }
      } catch (err) {
        // Log but do not fail the whole pipeline; routing log already recorded
        this.logger.error('Auto-reply generate/send failed', err as Error);
      }
    } else if (routeResult.action === 'pending_review') {
      try {
        const gen = await this.replyService.generate(userId, {
          incomingMessage: content,
          contactId: contact.id,
          profileId: routeResult.profileId ?? undefined,
          sceneId: routeResult.sceneId ?? undefined,
        });
        const log = await this.logRepo.findOne({
          where: { id: routeResult.routingLogId, userId },
        });
        if (log) {
          log.replyRecordId = gen.replyId;
          await this.logRepo.save(log);
        }
        this.notificationGateway.emitReplyGenerated(userId, {
          replyId: gen.replyId,
          messageId: message.id,
          contactNickname: contact.nickname,
          incomingMessage: content,
          candidates: gen.candidates,
          autoApprove: false,
          expiresAt: gen.expiresAt ?? '',
        });
        out.replyRecordId = gen.replyId;
      } catch (err) {
        this.logger.error('Pending-review generate failed', err as Error);
      }
    }

    return out;
  }

  private toLogItem(log: RoutingLog): Record<string, unknown> {
    const contact = log.contact as { nickname?: string } | undefined;
    const scene = log.scene as { name?: string } | undefined;
    return {
      id: log.id,
      messageId: log.messageId,
      contactId: log.contactId,
      contactNickname: contact?.nickname ?? null,
      platform: log.platform,
      incomingContent: log.incomingContent,
      action: log.action,
      reason: log.reason,
      sceneId: log.sceneId,
      sceneName: scene?.name ?? null,
      profileId: log.profileId,
      replyRecordId: log.replyRecordId,
      replySentContent: log.replySentContent,
      processingTime: log.processingTime,
      steps: log.steps,
      createdAt: log.createdAt,
    };
  }

  private toRuleItem(rule: RoutingRule): Record<string, unknown> {
    return {
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      isEnabled: rule.isEnabled,
      type: rule.type,
      conditions: rule.conditions,
      action: rule.action,
      actionConfig: rule.actionConfig,
      isSystem: rule.isSystem,
      createdAt: rule.createdAt,
    };
  }
}
