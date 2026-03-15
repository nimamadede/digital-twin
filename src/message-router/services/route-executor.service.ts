import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutingLog } from '../entities/routing-log.entity';
import { RuleEngineService, type RuleMatchContext } from './rule-engine.service';
import type { RoutingRule } from '../entities/routing-rule.entity';
import type { RoutingStepDetail } from '../entities/routing-log.entity';

export interface RouteContext {
  userId: string;
  messageId: string;
  contactId: string;
  contactNickname: string;
  platform: string;
  incomingContent: string;
  contact: {
    level: string;
    isWhitelist: boolean;
    isBlacklist: boolean;
    tags: string[];
  };
  message: {
    msgType: string;
    isGroup: boolean;
    length: number;
  };
}

export interface RouteResult {
  action: string;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  sceneId: string | null;
  sceneName: string | null;
  profileId: string | null;
  routingLogId: string;
  steps: RoutingStepDetail[];
  processingTime: number;
}

/**
 * Orchestrates the routing pipeline: receive -> contact -> rules -> scene -> (reply/send is handled by caller).
 */
@Injectable()
export class RouteExecutorService {
  constructor(
    @InjectRepository(RoutingLog)
    private readonly logRepo: Repository<RoutingLog>,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  /**
   * Run routing for an incoming message and persist a routing log.
   * Caller is responsible for generating/sending reply based on action.
   */
  async execute(
    ctx: RouteContext,
    rules: RoutingRule[],
    activeScene: { id: string; name: string; profileId: string | null } | null,
    isPaused: boolean,
  ): Promise<RouteResult> {
    const start = Date.now();
    const steps: RoutingStepDetail[] = [];

    const ruleMatchContext: RuleMatchContext = {
      contact: ctx.contact,
      message: {
        content: ctx.incomingContent,
        msgType: ctx.message.msgType,
        isGroup: ctx.message.isGroup,
        length: ctx.message.length,
      },
      platform: ctx.platform,
      time: new Date(),
    };

    steps.push({ step: 'receive', result: 'ok', duration: 0 });
    steps.push({
      step: 'contact_lookup',
      result: 'found',
      duration: 0,
      detail: {
        level: ctx.contact.level,
        isWhitelist: ctx.contact.isWhitelist,
        isBlacklist: ctx.contact.isBlacklist,
      },
    });

    if (isPaused) {
      const log = await this.persistLog(ctx, 'ignored', null, null, null, null, 'paused', steps, start);
      return this.toResult(log, null, null, start);
    }

    const matchResult = this.ruleEngine.matchRule(
      rules.sort((a, b) => a.priority - b.priority),
      ruleMatchContext,
    );

    let action = 'manual';
    let matchedRuleId: string | null = null;
    let matchedRuleName: string | null = null;
    let reason: string | null = null;

    if (matchResult) {
      matchedRuleId = matchResult.rule.id;
      matchedRuleName = matchResult.rule.name;
      action = matchResult.rule.action;
      reason = `${matchResult.rule.type}_${matchResult.rule.action}`;
      steps.push({
        step: 'rule_evaluate',
        result: 'matched',
        duration: 0,
        detail: { ruleId: matchResult.rule.id, ruleName: matchResult.rule.name },
      });
      for (const s of matchResult.stepDetails) {
        steps.push({ step: s.step, result: s.result, detail: s.detail as Record<string, unknown> });
      }
    } else {
      steps.push({ step: 'rule_evaluate', result: 'no_match', duration: 0 });
    }

    const sceneId = activeScene?.id ?? null;
    const sceneName = activeScene?.name ?? null;
    const profileId = activeScene?.profileId ?? null;
    if (sceneId) {
      steps.push({
        step: 'scene_match',
        result: sceneName ?? 'unknown',
        duration: 0,
        detail: { sceneId },
      });
    } else {
      steps.push({ step: 'scene_match', result: 'none', duration: 0 });
    }

    const processingTime = Date.now() - start;
    const log = await this.persistLog(
      ctx,
      action,
      matchedRuleId,
      sceneId,
      profileId,
      null,
      reason,
      steps,
      start,
    );

    return this.toResult(log, matchedRuleName, sceneName, start);
  }

  private async persistLog(
    ctx: RouteContext,
    action: string,
    matchedRuleId: string | null,
    sceneId: string | null,
    profileId: string | null,
    replyRecordId: string | null,
    reason: string | null,
    steps: RoutingStepDetail[],
    startTime: number,
  ): Promise<RoutingLog> {
    const log = this.logRepo.create({
      userId: ctx.userId,
      messageId: ctx.messageId,
      contactId: ctx.contactId,
      platform: ctx.platform,
      incomingContent: ctx.incomingContent,
      matchedRuleId,
      sceneId,
      profileId,
      replyRecordId,
      action,
      reason,
      replySentContent: null,
      steps,
      processingTime: Date.now() - startTime,
    });
    return this.logRepo.save(log);
  }

  private toResult(
    log: RoutingLog,
    matchedRuleName: string | null,
    sceneName: string | null,
    startTime: number,
  ): RouteResult {
    return {
      action: log.action,
      matchedRuleId: log.matchedRuleId,
      matchedRuleName: matchedRuleName ?? null,
      sceneId: log.sceneId,
      sceneName: sceneName ?? null,
      profileId: log.profileId,
      routingLogId: log.id,
      steps: log.steps,
      processingTime: log.processingTime,
    };
  }
}
