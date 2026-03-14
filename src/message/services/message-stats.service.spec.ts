import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageStatsService } from './message-stats.service';
import { Message } from '../entities/message.entity';
import { ReplyRecord } from '../../reply/entities/reply-record.entity';

const userId = 'user-uuid-1';

describe('MessageStatsService', () => {
  let service: MessageStatsService;
  let messageRepo: Repository<Message>;
  let replyRepo: Repository<ReplyRecord>;
  let messageQbCallIndex: number;

  beforeEach(async () => {
    messageQbCallIndex = 0;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageStatsService,
        {
          provide: getRepositoryToken(Message),
          useValue: {
            count: jest.fn().mockResolvedValue(100),
            createQueryBuilder: jest.fn(() => {
              const idx = messageQbCallIndex++;
              const timelineData = [
                { date: '2026-03-14', incoming: '42', outgoing: '38', ai_generated: '35' },
                { date: '2026-03-13', incoming: '55', outgoing: '50', ai_generated: '45' },
              ];
              const topContactsData = [
                { contactId: 'c1', nickname: '张三', messageCount: '128' },
              ];
              const chain: Record<string, unknown> = {};
              chain.select = jest.fn(() => chain);
              chain.addSelect = jest.fn(() => chain);
              chain.where = jest.fn(() => chain);
              chain.andWhere = jest.fn(() => chain);
              chain.innerJoin = jest.fn(() => chain);
              chain.groupBy = jest.fn(() => chain);
              chain.addGroupBy = jest.fn(() => chain);
              chain.orderBy = jest.fn(() => chain);
              chain.limit = jest.fn(() => chain);
              chain.getRawOne = jest.fn().mockResolvedValue(null);
              chain.getRawMany = jest.fn().mockResolvedValue(idx === 0 ? timelineData : topContactsData);
              return chain;
            }),
          },
        },
        {
          provide: getRepositoryToken(ReplyRecord),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({
                total: '50',
                sent: '40',
                avg_seconds: '12.5',
                avg_rating: '4.2',
              }),
            })),
          },
        },
      ],
    }).compile();

    service = module.get<MessageStatsService>(MessageStatsService);
    messageRepo = module.get<Repository<Message>>(getRepositoryToken(Message));
    replyRepo = module.get<Repository<ReplyRecord>>(getRepositoryToken(ReplyRecord));
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return summary, timeline and topContacts with user filter', async () => {
      const replyQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total: '50',
          sent: '40',
          avg_seconds: '12.5',
          avg_rating: '4.2',
        }),
      };
      (replyRepo.createQueryBuilder as jest.Mock).mockReturnValue(replyQb);

      const timelineQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { date: '2026-03-14', incoming: '42', outgoing: '38', ai_generated: '35' },
          { date: '2026-03-13', incoming: '55', outgoing: '50', ai_generated: '45' },
        ]),
      };
      const topContactsQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { contactId: 'c1', nickname: '张三', messageCount: '128' },
        ]),
      };
      (messageRepo.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(timelineQb)
        .mockReturnValueOnce(topContactsQb);

      const result = await service.getStats(userId, {
        period: 'week',
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalMessages).toBe(100);
      expect(result.summary.incomingMessages).toBe(100);
      expect(result.summary.outgoingMessages).toBe(100);
      expect(result.summary.aiGeneratedReplies).toBe(100);
      expect(result.timeline).toHaveLength(2);
      expect(result.timeline[0].date).toBeDefined();
      expect(result.timeline[0].incoming).toBe(42);
      expect(result.timeline[0].aiGenerated).toBe(35);
      expect(result.topContacts).toBeDefined();
    });

    it('should use startDate and endDate when provided', async () => {
      const replyQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total: '0',
          sent: '0',
          avg_seconds: null,
          avg_rating: null,
        }),
      };
      const timelineQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      const topContactsQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      (replyRepo.createQueryBuilder as jest.Mock).mockReturnValue(replyQb);
      (messageRepo.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(timelineQb)
        .mockReturnValueOnce(topContactsQb);

      await service.getStats(userId, {
        startDate: '2026-03-01',
        endDate: '2026-03-14',
      });

      expect(messageRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId }),
        }),
      );
    });
  });
});
