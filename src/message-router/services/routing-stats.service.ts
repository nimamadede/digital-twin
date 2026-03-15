import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { RoutingLog } from '../entities/routing-log.entity';
import { RoutingRule } from '../entities/routing-rule.entity';

export interface RouterDashboardDto {
  status: 'running' | 'paused';
  activeSceneId: string | null;
  activeSceneName: string | null;
  today: {
    totalReceived: number;
    autoReplied: number;
    pendingReview: number;
    manualReplied: number;
    rejected: number;
    expired: number;
    blocked: number;
  };
  queueDepth: number;
  avgResponseTime: number;
  connectedPlatforms: Array<{
    platform: string;
    status: string;
    messagesReceived: number;
  }>;
}

export interface RouterStatsDto {
  summary: {
    totalProcessed: number;
    autoReplied: number;
    pendingReview: number;
    manualReplied: number;
    blocked: number;
    ignored: number;
    expired: number;
    avgProcessingTime: number;
    autoApproveRate: number;
    blockRate: number;
  };
  byAction: Array<{ action: string; count: number; percentage: number }>;
  byPlatform: Array<{ platform: string; count: number }>;
  timeline: Array<{
    date: string;
    received: number;
    autoReplied: number;
    blocked: number;
  }>;
  topTriggeredRules: Array<{
    ruleId: string;
    ruleName: string;
    triggerCount: number;
  }>;
}

@Injectable()
export class RoutingStatsService {
  constructor(
    @InjectRepository(RoutingLog)
    private readonly logRepo: Repository<RoutingLog>,
    @InjectRepository(RoutingRule)
    private readonly ruleRepo: Repository<RoutingRule>,
  ) {}

  async getDashboard(
    userId: string,
    status: 'running' | 'paused',
    activeScene: { id: string; name: string } | null,
  ): Promise<RouterDashboardDto> {
    const { startOfToday, endOfToday } = this.getDayRange(new Date());
    const qb = this.logRepo
      .createQueryBuilder('log')
      .where('log.user_id = :userId', { userId })
      .andWhere('log.created_at >= :start', { start: startOfToday })
      .andWhere('log.created_at <= :end', { end: endOfToday });

    const logs = await qb.getMany();
    const totalReceived = logs.length;
    const autoReplied = logs.filter((l) => l.action === 'auto_reply').length;
    const pendingReview = logs.filter((l) => l.action === 'pending_review').length;
    const manualReplied = logs.filter((l) => l.action === 'manual').length;
    const rejected = 0; // not stored in action; could be derived from reply_records
    const expired = logs.filter((l) => l.action === 'expired').length;
    const blocked = logs.filter((l) => l.action === 'blocked').length;

    const withTime = logs.filter((l) => l.processingTime > 0);
    const avgResponseTime =
      withTime.length > 0
        ? withTime.reduce((s, l) => s + l.processingTime, 0) / withTime.length
        : 0;

    const platformMap = new Map<string, number>();
    for (const l of logs) {
      platformMap.set(l.platform, (platformMap.get(l.platform) ?? 0) + 1);
    }
    const connectedPlatforms = Array.from(platformMap.entries()).map(
      ([platform, messagesReceived]) => ({
        platform,
        status: 'listening',
        messagesReceived,
      }),
    );

    return {
      status,
      activeSceneId: activeScene?.id ?? null,
      activeSceneName: activeScene?.name ?? null,
      today: {
        totalReceived,
        autoReplied,
        pendingReview,
        manualReplied,
        rejected,
        expired,
        blocked,
      },
      queueDepth: 0,
      avgResponseTime: Math.round(avgResponseTime * 10) / 10,
      connectedPlatforms,
    };
  }

  async getStats(
    userId: string,
    period: 'day' | 'week' | 'month',
    startDate?: string,
    endDate?: string,
  ): Promise<RouterStatsDto> {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : this.getPeriodStart(end, period);
    const startOf = start;
    const endOf = end;

    const logs = await this.logRepo.find({
      where: {
        userId,
        createdAt: Between(startOf, endOf),
      },
    });

    const totalProcessed = logs.length;
    const autoReplied = logs.filter((l) => l.action === 'auto_reply').length;
    const pendingReview = logs.filter((l) => l.action === 'pending_review').length;
    const manualReplied = logs.filter((l) => l.action === 'manual').length;
    const blocked = logs.filter((l) => l.action === 'blocked').length;
    const ignored = logs.filter((l) => l.action === 'ignored').length;
    const expired = logs.filter((l) => l.action === 'expired').length;
    const withTime = logs.filter((l) => l.processingTime > 0);
    const avgProcessingTime =
      withTime.length > 0
        ? withTime.reduce((s, l) => s + l.processingTime, 0) / withTime.length
        : 0;
    const autoApproveRate =
      totalProcessed > 0 ? autoReplied / totalProcessed : 0;
    const blockRate = totalProcessed > 0 ? blocked / totalProcessed : 0;

    const actionCounts = new Map<string, number>();
    for (const l of logs) {
      actionCounts.set(l.action, (actionCounts.get(l.action) ?? 0) + 1);
    }
    const byAction = Array.from(actionCounts.entries()).map(([action, count]) => ({
      action,
      count,
      percentage: totalProcessed > 0 ? count / totalProcessed : 0,
    }));

    const platformCounts = new Map<string, number>();
    for (const l of logs) {
      platformCounts.set(l.platform, (platformCounts.get(l.platform) ?? 0) + 1);
    }
    const byPlatform = Array.from(platformCounts.entries()).map(
      ([platform, count]) => ({ platform, count }),
    );

    const byDate = new Map<
      string,
      { received: number; autoReplied: number; blocked: number }
    >();
    for (const l of logs) {
      const d = l.createdAt.toISOString().slice(0, 10);
      const cur = byDate.get(d) ?? {
        received: 0,
        autoReplied: 0,
        blocked: 0,
      };
      cur.received += 1;
      if (l.action === 'auto_reply') cur.autoReplied += 1;
      if (l.action === 'blocked') cur.blocked += 1;
      byDate.set(d, cur);
    }
    const timeline = Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    const ruleIds = logs
      .map((l) => l.matchedRuleId)
      .filter((id): id is string => id != null);
    const ruleCounts = new Map<string, number>();
    for (const id of ruleIds) {
      ruleCounts.set(id, (ruleCounts.get(id) ?? 0) + 1);
    }
    const ruleIdsSorted = Array.from(ruleCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    const topRuleIds = ruleIdsSorted.slice(0, 10).map(([id]) => id);
    const rules =
      topRuleIds.length > 0
        ? await this.ruleRepo.find({
            where: { id: In(topRuleIds), userId },
          })
        : [];
    const ruleMap = new Map(rules.map((r) => [r.id, r]));
    const topTriggeredRules = ruleIdsSorted.slice(0, 10).map(([ruleId, triggerCount]) => ({
      ruleId,
      ruleName: ruleMap.get(ruleId)?.name ?? 'Unknown',
      triggerCount,
    }));

    return {
      summary: {
        totalProcessed,
        autoReplied,
        pendingReview,
        manualReplied,
        blocked,
        ignored,
        expired,
        avgProcessingTime: Math.round(avgProcessingTime),
        autoApproveRate: Math.round(autoApproveRate * 1000) / 1000,
        blockRate: Math.round(blockRate * 1000) / 1000,
      },
      byAction,
      byPlatform,
      timeline,
      topTriggeredRules,
    };
  }

  private getDayRange(d: Date): { startOfToday: Date; endOfToday: Date } {
    const start = new Date(d);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setUTCHours(23, 59, 59, 999);
    return { startOfToday: start, endOfToday: end };
  }

  private getPeriodStart(end: Date, period: 'day' | 'week' | 'month'): Date {
    const start = new Date(end);
    if (period === 'day') {
      start.setDate(start.getDate() - 1);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 7);
    } else {
      start.setMonth(start.getMonth() - 1);
    }
    return start;
  }
}
