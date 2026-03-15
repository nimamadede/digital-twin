import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutingStatsService } from './routing-stats.service';
import { RoutingLog } from '../entities/routing-log.entity';
import { RoutingRule } from '../entities/routing-rule.entity';

const userId = 'user-uuid-1';

const mockLogs: Partial<RoutingLog>[] = [
  {
    id: 'log-1',
    userId,
    action: 'auto_reply',
    platform: 'wechat',
    processingTime: 100,
    createdAt: new Date('2026-03-14T10:00:00.000Z'),
  },
  {
    id: 'log-2',
    userId,
    action: 'auto_reply',
    platform: 'wechat',
    processingTime: 200,
    createdAt: new Date('2026-03-14T11:00:00.000Z'),
  },
  {
    id: 'log-3',
    userId,
    action: 'blocked',
    platform: 'wechat',
    processingTime: 5,
    createdAt: new Date('2026-03-14T12:00:00.000Z'),
  },
];

describe('RoutingStatsService', () => {
  let service: RoutingStatsService;
  let logRepo: Repository<RoutingLog>;
  let ruleRepo: Repository<RoutingRule>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingStatsService,
        {
          provide: getRepositoryToken(RoutingLog),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(mockLogs),
            })),
            find: jest.fn().mockResolvedValue(mockLogs),
          },
        },
        {
          provide: getRepositoryToken(RoutingRule),
          useValue: {
            find: jest.fn().mockResolvedValue([
              { id: 'rule-1', name: '白名单自动回复', userId },
            ]),
          },
        },
      ],
    }).compile();

    service = module.get<RoutingStatsService>(RoutingStatsService);
    logRepo = module.get<Repository<RoutingLog>>(getRepositoryToken(RoutingLog));
    ruleRepo = module.get<Repository<RoutingRule>>(getRepositoryToken(RoutingRule));
  });

  describe('getDashboard', () => {
    it('should return dashboard with today stats and status', async () => {
      const result = await service.getDashboard(
        userId,
        'running',
        { id: 'scene-1', name: '工作模式' },
      );
      expect(result.status).toBe('running');
      expect(result.activeSceneId).toBe('scene-1');
      expect(result.activeSceneName).toBe('工作模式');
      expect(result.today.totalReceived).toBe(3);
      expect(result.today.autoReplied).toBe(2);
      expect(result.today.blocked).toBe(1);
      expect(result.avgResponseTime).toBeGreaterThanOrEqual(0);
      expect(result.connectedPlatforms).toContainEqual(
        expect.objectContaining({ platform: 'wechat', status: 'listening' }),
      );
    });
  });

  describe('getStats', () => {
    it('should return summary and byAction with user_id scope', async () => {
      const result = await service.getStats(userId, 'day');
      expect(result.summary.totalProcessed).toBe(3);
      expect(result.summary.autoReplied).toBe(2);
      expect(result.summary.blocked).toBe(1);
      expect(result.byAction.length).toBeGreaterThan(0);
      expect(result.byPlatform).toContainEqual(
        expect.objectContaining({ platform: 'wechat' }),
      );
    });
  });
});
