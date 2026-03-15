import { Injectable } from '@nestjs/common';
import type { RoutingRule, RuleConditions } from '../entities/routing-rule.entity';

export interface RuleMatchContext {
  contact: {
    level?: string;
    isWhitelist?: boolean;
    isBlacklist?: boolean;
    tags?: string[];
  };
  message: {
    content: string;
    msgType?: string;
    isGroup?: boolean;
    length: number;
  };
  platform: string;
  time: Date;
}

export interface RuleMatchResult {
  rule: RoutingRule;
  stepDetails: Array<{ step: string; result: string; detail?: unknown }>;
}

/**
 * Evaluates routing rules against context. Returns first matching rule (by priority).
 */
@Injectable()
export class RuleEngineService {
  /**
   * Find first rule that matches the context. Rules must be sorted by priority (asc).
   */
  matchRule(
    rules: RoutingRule[],
    context: RuleMatchContext,
  ): RuleMatchResult | null {
    const enabled = rules.filter((r) => r.isEnabled);
    for (const rule of enabled) {
      const stepDetails: RuleMatchResult['stepDetails'] = [];
      const matched = this.evaluateConditions(rule.conditions, context, (step, result, detail) => {
        stepDetails.push({ step: `rule_${rule.priority}_${rule.name}`, result, detail });
      });
      if (matched) {
        return { rule, stepDetails };
      }
    }
    return null;
  }

  /**
   * Evaluate a single rule's conditions. All present condition groups must pass.
   */
  evaluateConditions(
    conditions: RuleConditions,
    context: RuleMatchContext,
    onStep?: (step: string, result: string, detail?: unknown) => void,
  ): boolean {
    if (conditions.contact !== undefined) {
      const pass = this.matchContact(conditions.contact, context.contact);
      onStep?.('contact', pass ? 'matched' : 'skip', conditions.contact);
      if (!pass) return false;
    }
    if (conditions.message !== undefined) {
      const pass = this.matchMessage(conditions.message, context.message);
      onStep?.('message', pass ? 'matched' : 'skip', conditions.message);
      if (!pass) return false;
    }
    if (conditions.platform !== undefined) {
      const pass = this.matchPlatform(conditions.platform, context.platform);
      onStep?.('platform', pass ? 'matched' : 'skip', conditions.platform);
      if (!pass) return false;
    }
    if (conditions.time !== undefined) {
      const pass = this.matchTime(conditions.time, context.time);
      onStep?.('time', pass ? 'matched' : 'skip', {
        timeMatch: pass,
        startTime: conditions.time.startTime,
        endTime: conditions.time.endTime,
        weekdays: conditions.time.weekdays,
      });
      if (!pass) return false;
    }
    return true;
  }

  private matchContact(
    cond: NonNullable<RuleConditions['contact']>,
    contact: RuleMatchContext['contact'],
  ): boolean {
    if (cond.level !== undefined && contact.level !== cond.level) return false;
    if (cond.isWhitelist !== undefined && contact.isWhitelist !== cond.isWhitelist) return false;
    if (cond.isBlacklist !== undefined && contact.isBlacklist !== cond.isBlacklist) return false;
    if (cond.tags !== undefined && cond.tags.length > 0) {
      const contactTags = contact.tags ?? [];
      const hasAny = cond.tags.some((t) => contactTags.includes(t));
      if (!hasAny) return false;
    }
    return true;
  }

  private matchMessage(
    cond: NonNullable<RuleConditions['message']>,
    message: RuleMatchContext['message'],
  ): boolean {
    if (cond.containsKeywords !== undefined && cond.containsKeywords.length > 0) {
      const content = (message.content ?? '').toLowerCase();
      const hasAny = cond.containsKeywords.some((k) =>
        content.includes(k.toLowerCase()),
      );
      if (!hasAny) return false;
    }
    if (cond.msgType !== undefined && message.msgType !== cond.msgType) return false;
    if (cond.isGroup !== undefined && message.isGroup !== cond.isGroup) return false;
    const len = message.length ?? 0;
    if (cond.lengthMin !== undefined && len < cond.lengthMin) return false;
    if (cond.lengthMax !== undefined && len > cond.lengthMax) return false;
    return true;
  }

  private matchPlatform(
    cond: NonNullable<RuleConditions['platform']>,
    platform: string,
  ): boolean {
    if (cond.in === undefined || cond.in.length === 0) return true;
    return cond.in.includes(platform);
  }

  private matchTime(
    cond: NonNullable<RuleConditions['time']>,
    time: Date,
  ): boolean {
    if (cond.startTime !== undefined || cond.endTime !== undefined) {
      const t = time.getHours() * 60 + time.getMinutes();
      const parse = (s: string) => {
        const [h, m] = s.split(':').map(Number);
        return (h ?? 0) * 60 + (m ?? 0);
      };
      const start = cond.startTime !== undefined ? parse(cond.startTime) : 0;
      const end = cond.endTime !== undefined ? parse(cond.endTime) : 24 * 60;
      if (t < start || t > end) return false;
    }
    if (cond.weekdays !== undefined && cond.weekdays.length > 0) {
      // getDay(): 0 = Sunday, 1 = Monday, ... API uses 1-7 (e.g. 1=Mon)
      const day = time.getDay(); // 0-6
      const apiDay = day === 0 ? 7 : day; // map Sun=7 or keep 1-7 as Mon-Sun per spec
      if (!cond.weekdays.includes(apiDay)) return false;
    }
    return true;
  }
}
