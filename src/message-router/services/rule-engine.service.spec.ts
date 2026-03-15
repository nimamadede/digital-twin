import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService, type RuleMatchContext } from './rule-engine.service';
import type { RoutingRule } from '../entities/routing-rule.entity';

describe('RuleEngineService', () => {
  let service: RuleEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleEngineService],
    }).compile();
    service = module.get<RuleEngineService>(RuleEngineService);
  });

  const baseContext: RuleMatchContext = {
    contact: {
      level: 'important',
      isWhitelist: true,
      isBlacklist: false,
      tags: ['客户'],
    },
    message: {
      content: '明天下午有时间吗？',
      msgType: 'text',
      isGroup: false,
      length: 10,
    },
    platform: 'wechat',
    time: new Date('2026-03-14T14:30:00.000Z'), // Friday
  };

  function rule(overrides: Partial<RoutingRule>): RoutingRule {
    return {
      id: 'rule-1',
      userId: 'user-1',
      name: 'Test',
      priority: 50,
      isEnabled: true,
      isSystem: false,
      type: 'route',
      conditions: {},
      action: 'auto_reply',
      actionConfig: {},
      triggerCount: 0,
      lastTriggeredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as RoutingRule;
  }

  describe('matchRule', () => {
    it('should return null when no rules', () => {
      const result = service.matchRule([], baseContext);
      expect(result).toBeNull();
    });

    it('should return null when no rule matches', () => {
      const rules: RoutingRule[] = [
        rule({
          id: 'r1',
          priority: 1,
          name: 'Blacklist',
          conditions: { contact: { isBlacklist: true } },
          action: 'blocked',
        }),
      ];
      const result = service.matchRule(rules, baseContext);
      expect(result).toBeNull();
    });

    it('should return first matching rule by priority', () => {
      const rules: RoutingRule[] = [
        rule({
          id: 'r1',
          priority: 1,
          name: 'Blacklist',
          conditions: { contact: { isBlacklist: true } },
          action: 'blocked',
        }),
        rule({
          id: 'r2',
          priority: 2,
          name: 'Whitelist',
          conditions: { contact: { isWhitelist: true } },
          action: 'auto_reply',
        }),
      ];
      const result = service.matchRule(rules, baseContext);
      expect(result).not.toBeNull();
      expect(result!.rule.id).toBe('r2');
      expect(result!.rule.name).toBe('Whitelist');
      expect(result!.stepDetails.length).toBeGreaterThan(0);
    });

    it('should skip disabled rules', () => {
      const rules: RoutingRule[] = [
        rule({
          id: 'r1',
          priority: 1,
          name: 'Whitelist',
          isEnabled: false,
          conditions: { contact: { isWhitelist: true } },
          action: 'auto_reply',
        }),
        rule({
          id: 'r2',
          priority: 2,
          name: 'Fallback',
          conditions: {},
          action: 'manual',
        }),
      ];
      const result = service.matchRule(rules, baseContext);
      expect(result).not.toBeNull();
      expect(result!.rule.id).toBe('r2');
    });

    it('should match contact level', () => {
      const rules: RoutingRule[] = [
        rule({
          id: 'r1',
          priority: 1,
          conditions: { contact: { level: 'important' } },
          action: 'pending_review',
        }),
      ];
      const result = service.matchRule(rules, baseContext);
      expect(result).not.toBeNull();
      expect(result!.rule.action).toBe('pending_review');
    });

    it('should match message keywords', () => {
      const rules: RoutingRule[] = [
        rule({
          id: 'r1',
          priority: 1,
          conditions: {
            message: { containsKeywords: ['转账', '借钱'] },
          },
          action: 'blocked',
        }),
      ];
      const result = service.matchRule(rules, baseContext);
      expect(result).toBeNull();

      const ctxWithKeyword: RuleMatchContext = {
        ...baseContext,
        message: { ...baseContext.message, content: '能借我点钱转账吗' },
      };
      const result2 = service.matchRule(rules, ctxWithKeyword);
      expect(result2).not.toBeNull();
      expect(result2!.rule.action).toBe('blocked');
    });

    it('should match platform', () => {
      const rules: RoutingRule[] = [
        rule({
          id: 'r1',
          priority: 1,
          conditions: { platform: { in: ['wechat'] } },
          action: 'auto_reply',
        }),
      ];
      const result = service.matchRule(rules, baseContext);
      expect(result).not.toBeNull();

      const ctxDouyin: RuleMatchContext = {
        ...baseContext,
        platform: 'douyin',
      };
      const result2 = service.matchRule(rules, ctxDouyin);
      expect(result2).toBeNull();
    });

    it('should match time weekdays (1-7, 5 = Friday)', () => {
      const rules: RoutingRule[] = [
        rule({
          id: 'r1',
          priority: 1,
          conditions: { time: { weekdays: [1, 2, 3, 4, 5] } },
          action: 'auto_reply',
        }),
      ];
      // 2026-03-14 is Saturday (getDay=6). So API weekday = 6.
      const saturday = new Date('2026-03-14T14:30:00.000Z');
      const ctxSat: RuleMatchContext = { ...baseContext, time: saturday };
      const resultSat = service.matchRule(rules, ctxSat);
      // getDay() 6 = Saturday. Our mapping: 0->7, 1->1,... 6->6. So Saturday=6. Rule has [1,2,3,4,5] so no match.
      expect(resultSat).toBeNull();

      const friday = new Date('2026-03-13T14:30:00.000Z'); // Friday getDay=5
      const ctxFri: RuleMatchContext = { ...baseContext, time: friday };
      const resultFri = service.matchRule(rules, ctxFri);
      expect(resultFri).not.toBeNull();
    });
  });

  describe('evaluateConditions', () => {
    it('should return true when no conditions', () => {
      const pass = service.evaluateConditions({}, baseContext);
      expect(pass).toBe(true);
    });

    it('should fail when contact level does not match', () => {
      const pass = service.evaluateConditions(
        { contact: { level: 'normal' } },
        baseContext,
      );
      expect(pass).toBe(false);
    });

    it('should fail when message length out of range', () => {
      const pass = service.evaluateConditions(
        { message: { lengthMin: 100 } },
        baseContext,
      );
      expect(pass).toBe(false);
    });
  });
});
