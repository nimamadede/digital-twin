import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Message } from '../entities/message.entity';
import { ReplyRecord } from '../../reply/entities/reply-record.entity';
import type { MessageStatsQueryDto } from '../dto/stats-query.dto';

export interface MessageStatsSummary {
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  aiGeneratedReplies: number;
  manualReplies: number;
  autoApproveRate: number;
  avgResponseTime: number;
  feedbackAvgRating: number;
}

export interface MessageStatsTimelineItem {
  date: string;
  incoming: number;
  outgoing: number;
  aiGenerated: number;
}

export interface MessageStatsTopContact {
  contactId: string;
  nickname: string;
  messageCount: number;
}

export interface MessageStatsResult {
  summary: MessageStatsSummary;
  timeline: MessageStatsTimelineItem[];
  topContacts: MessageStatsTopContact[];
}

@Injectable()
export class MessageStatsService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(ReplyRecord)
    private readonly replyRepo: Repository<ReplyRecord>,
  ) {}

  /**
   * Get message statistics. All queries scoped by userId (data isolation).
   */
  async getStats(
    userId: string,
    query: MessageStatsQueryDto,
  ): Promise<MessageStatsResult> {
    const { startDate, endDate } = this.resolveDateRange(query);

    const summary = await this.getSummary(userId, startDate, endDate);
    const timeline = await this.getTimeline(userId, startDate, endDate);
    const topContacts = await this.getTopContacts(userId, startDate, endDate);

    return { summary, timeline, topContacts };
  }

  private resolveDateRange(query: MessageStatsQueryDto): {
    startDate: string;
    endDate: string;
  } {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end.setUTCHours(23, 59, 59, 999);

    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
      end.setUTCHours(23, 59, 59, 999);
    } else if (query.period === 'day') {
      start = new Date(end);
      start.setDate(start.getDate() - 1);
    } else if (query.period === 'week') {
      start = new Date(end);
      start.setDate(start.getDate() - 7);
    } else if (query.period === 'month') {
      start = new Date(end);
      start.setMonth(start.getMonth() - 1);
    } else {
      start = new Date(end);
      start.setMonth(start.getMonth() - 1);
    }

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  private async getSummary(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<MessageStatsSummary> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const [total, incoming, outgoing, aiGenerated] = await Promise.all([
      this.messageRepo.count({
        where: { userId, createdAt: Between(start, end) },
      }),
      this.messageRepo.count({
        where: { userId, direction: 'incoming', createdAt: Between(start, end) },
      }),
      this.messageRepo.count({
        where: { userId, direction: 'outgoing', createdAt: Between(start, end) },
      }),
      this.messageRepo.count({
        where: {
          userId,
          direction: 'outgoing',
          isAiGenerated: true,
          createdAt: Between(start, end),
        },
      }),
    ]);

    const manualReplies = outgoing - aiGenerated;

    const replyStats = await this.replyRepo
      .createQueryBuilder('r')
      .select('COUNT(r.id)', 'total')
      .addSelect("COUNT(CASE WHEN r.status = 'sent' THEN 1 END)", 'sent')
      .addSelect(
        'AVG(EXTRACT(EPOCH FROM (r.sentAt - r.createdAt)))',
        'avg_seconds',
      )
      .addSelect('AVG(r.feedbackRating)', 'avg_rating')
      .where('r.userId = :userId', { userId })
      .andWhere('r.createdAt >= :start', { start })
      .andWhere('r.createdAt <= :end', { end })
      .getRawOne<{
        total: string;
        sent: string;
        avg_seconds: string | null;
        avg_rating: string | null;
      }>();

    const totalReplies = parseInt(replyStats?.total ?? '0', 10);
    const sentReplies = parseInt(replyStats?.sent ?? '0', 10);
    const autoApproveRate =
      totalReplies > 0 ? Math.round((sentReplies / totalReplies) * 100) / 100 : 0;
    const avgResponseTime = replyStats?.avg_seconds
      ? parseFloat(parseFloat(replyStats.avg_seconds).toFixed(1))
      : 0;
    const feedbackAvgRating = replyStats?.avg_rating
      ? parseFloat(parseFloat(replyStats.avg_rating).toFixed(1))
      : 0;

    return {
      totalMessages: total,
      incomingMessages: incoming,
      outgoingMessages: outgoing,
      aiGeneratedReplies: aiGenerated,
      manualReplies,
      autoApproveRate,
      avgResponseTime,
      feedbackAvgRating,
    };
  }

  private async getTimeline(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<MessageStatsTimelineItem[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .select("DATE(m.createdAt)", 'date')
      .addSelect("COUNT(CASE WHEN m.direction = 'incoming' THEN 1 END)", 'incoming')
      .addSelect("COUNT(CASE WHEN m.direction = 'outgoing' THEN 1 END)", 'outgoing')
      .addSelect(
        "COUNT(CASE WHEN m.direction = 'outgoing' AND m.isAiGenerated = true THEN 1 END)",
        'ai_generated',
      )
      .where('m.userId = :userId', { userId })
      .andWhere('m.createdAt >= :start', { start })
      .andWhere('m.createdAt <= :end', { end })
      .groupBy("DATE(m.createdAt)")
      .orderBy("DATE(m.createdAt)", 'DESC')
      .limit(31)
      .getRawMany<{
        date: string;
        incoming: string;
        outgoing: string;
        ai_generated: string;
      }>();

    return rows.map((r) => ({
      date: String(r.date),
      incoming: parseInt(r.incoming, 10),
      outgoing: parseInt(r.outgoing, 10),
      aiGenerated: parseInt(r.ai_generated, 10),
    }));
  }

  private async getTopContacts(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<MessageStatsTopContact[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .innerJoin('m.contact', 'c')
      .select('m.contactId', 'contactId')
      .addSelect('c.nickname', 'nickname')
      .addSelect('COUNT(m.id)', 'messageCount')
      .where('m.userId = :userId', { userId })
      .andWhere('m.createdAt >= :start', { start })
      .andWhere('m.createdAt <= :end', { end })
      .groupBy('m.contactId')
      .addGroupBy('c.nickname')
      .orderBy('messageCount', 'DESC')
      .limit(10)
      .getRawMany<{ contactId: string; nickname: string; messageCount: string }>();

    return rows.map((r) => ({
      contactId: r.contactId,
      nickname: r.nickname,
      messageCount: parseInt(r.messageCount, 10),
    }));
  }
}
