import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MessageRouterService } from './message-router.service';
import { RoutingLog } from './entities/routing-log.entity';
import { RoutingRule } from './entities/routing-rule.entity';
import { RuleEngineService } from './services/rule-engine.service';
import { RoutingStatsService } from './services/routing-stats.service';
import { RouteExecutorService } from './services/route-executor.service';
import { ContactService } from '../contact/contact.service';
import { SceneService } from '../scene/scene.service';
import { MessageService } from '../message/message.service';
import { ReplyService } from '../reply/reply.service';

const userId = 'user-uuid-1';
const ruleId = 'rule-uuid-1';
const logId = 'log-uuid-1';
const contactId = 'contact-uuid-1';

const mockRule = {
  id: ruleId,
  userId,
  name: '白名单自动回复',
  priority: 20,
  isEnabled: true,
  isSystem: false,
  type: 'route',
  conditions: { contact: { isWhitelist: true } },
  action: 'auto_reply',
  actionConfig: { autoApprove: true },
  triggerCount: 0,
  lastTriggeredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as RoutingRule;

const mockLog = {
  id: logId,
  userId,
  messageId: 'msg-1',
  contactId,
  platform: 'wechat',
  incomingContent: '你好',
  action: 'auto_reply',
  reason: 'whitelist_auto_approve',
  steps: [],
  processingTime: 100,
  createdAt: new Date(),
  contact: { nickname: '张三' },
  scene: { name: '工作模式' },
} as unknown as RoutingLog;

describe('MessageRouterService', () => {
  let service: MessageRouterService;
  let moduleRef: TestingModule;
  let logRepo: Repository<RoutingLog>;
  let ruleRepo: Repository<RoutingRule>;
  let routingStats: RoutingStatsService;
  let contactService: ContactService;
  let sceneService: SceneService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        MessageRouterService,
        {
          provide: getRepositoryToken(RoutingLog),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[mockLog], 1]),
            })),
            findOne: jest.fn(),
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve({ ...x, id: logId })),
          },
        },
        {
          provide: getRepositoryToken(RoutingRule),
          useValue: {
            find: jest.fn().mockResolvedValue([mockRule]),
            findOne: jest.fn().mockResolvedValue(mockRule),
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve({ ...x, id: ruleId })),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RuleEngineService,
          useValue: {
            matchRule: jest.fn().mockReturnValue({
              rule: mockRule,
              stepDetails: [{ step: 'rule_20_白名单自动回复', result: 'matched' }],
            }),
          },
        },
        {
          provide: RoutingStatsService,
          useValue: {
            getDashboard: jest.fn().mockImplementation((_uid: string, status: string) =>
              Promise.resolve({
                status,
                activeSceneId: 'scene-1',
                activeSceneName: '工作模式',
                today: { totalReceived: 10, autoReplied: 8 },
                queueDepth: 0,
                avgResponseTime: 3.5,
                connectedPlatforms: [{ platform: 'wechat', status: 'listening', messagesReceived: 10 }],
              }),
            ),
            getStats: jest.fn().mockResolvedValue({
              summary: { totalProcessed: 100, autoReplied: 70 },
              byAction: [],
              byPlatform: [],
              timeline: [],
              topTriggeredRules: [],
            }),
          },
        },
        {
          provide: RouteExecutorService,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              action: 'auto_reply',
              routingLogId: logId,
              sceneId: 'scene-1',
              profileId: 'profile-1',
            }),
          },
        },
        {
          provide: ContactService,
          useValue: {
            findOneOrFail: jest.fn().mockResolvedValue({
              id: contactId,
              nickname: '张三',
              level: 'important',
              isWhitelist: true,
              isBlacklist: false,
              tags: ['客户'],
            }),
            findOrCreateByPlatform: jest.fn().mockResolvedValue({
              id: contactId,
              nickname: '张三',
              level: 'normal',
              isWhitelist: false,
              isBlacklist: false,
              tags: [],
            }),
          },
        },
        {
          provide: SceneService,
          useValue: {
            findActive: jest.fn().mockResolvedValue({
              id: 'scene-1',
              name: '工作模式',
              profileId: 'profile-1',
            }),
          },
        },
        {
          provide: MessageService,
          useValue: {
            createIncoming: jest.fn().mockResolvedValue({ id: 'msg-1' }),
            createOutgoing: jest.fn().mockResolvedValue({ id: 'msg-out-1' }),
          },
        },
        {
          provide: ReplyService,
          useValue: {
            generate: jest.fn().mockResolvedValue({ replyId: 'reply-1' }),
            review: jest.fn().mockResolvedValue({
              status: 'sent',
              sentContent: '有啊，什么事？',
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<MessageRouterService>(MessageRouterService);
    logRepo = moduleRef.get<Repository<RoutingLog>>(getRepositoryToken(RoutingLog));
    ruleRepo = moduleRef.get<Repository<RoutingRule>>(getRepositoryToken(RoutingRule));
    routingStats = moduleRef.get<RoutingStatsService>(RoutingStatsService);
    contactService = moduleRef.get<ContactService>(ContactService);
    sceneService = moduleRef.get<SceneService>(SceneService);
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return dashboard with user_id isolation', async () => {
      const result = await service.getDashboard(userId);
      expect(routingStats.getDashboard).toHaveBeenCalledWith(
        userId,
        'running',
        expect.objectContaining({ id: 'scene-1', name: '工作模式' }),
      );
      expect(result.status).toBe('running');
      expect(result.activeSceneName).toBe('工作模式');
    });

    it('should return paused when paused', async () => {
      service.pause(userId);
      const result = await service.getDashboard(userId);
      expect(routingStats.getDashboard).toHaveBeenCalledWith(userId, 'paused', expect.any(Object));
      expect(result.status).toBe('paused');
      service.resume(userId);
    });
  });

  describe('pause / resume', () => {
    it('should set and clear pause state', () => {
      expect(service.isPaused(userId)).toBe(false);
      const pauseData = service.pause(userId);
      expect(pauseData.status).toBe('paused');
      expect(service.isPaused(userId)).toBe(true);
      const resumeData = service.resume(userId);
      expect(resumeData.status).toBe('running');
      expect(service.isPaused(userId)).toBe(false);
    });
  });

  describe('getLogById', () => {
    it('should return log when found', async () => {
      (logRepo.findOne as jest.Mock).mockResolvedValue(mockLog);
      const result = await service.getLogById(userId, logId);
      expect(logRepo.findOne).toHaveBeenCalledWith({
        where: { id: logId, userId },
        relations: ['contact', 'scene'],
      });
      expect(result.id).toBe(logId);
      expect(result.contactNickname).toBe('张三');
    });

    it('should throw NotFoundException when not found', async () => {
      (logRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.getLogById(userId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRules', () => {
    it('should return rules ordered by priority with user_id filter', async () => {
      const result = await service.getRules(userId);
      expect(ruleRepo.find).toHaveBeenCalledWith({
        where: { userId },
        order: { priority: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: ruleId, name: '白名单自动回复', priority: 20 });
    });
  });

  describe('createRule', () => {
    it('should create rule with userId', async () => {
      const dto = {
        name: '工作群忽略',
        priority: 5,
        isEnabled: true,
        type: 'block' as const,
        conditions: { message: { isGroup: true } },
        action: 'ignored' as const,
      };
      const result = await service.createRule(userId, dto);
      expect(ruleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          name: '工作群忽略',
          priority: 5,
          isSystem: false,
        }),
      );
      expect(ruleRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('工作群忽略');
      expect(result.priority).toBe(5);
    });
  });

  describe('updateRule', () => {
    it('should update rule when found', async () => {
      const ruleCopy = { ...mockRule, name: '白名单自动回复' };
      const updated = { ...ruleCopy, name: 'Updated Name' };
      (ruleRepo.findOne as jest.Mock).mockResolvedValue(ruleCopy);
      (ruleRepo.save as jest.Mock).mockResolvedValue(updated);
      const result = await service.updateRule(userId, ruleId, { name: 'Updated Name' });
      expect(ruleRepo.findOne).toHaveBeenCalledWith({ where: { id: ruleId, userId } });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when rule not found', async () => {
      (ruleRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateRule(userId, 'non-existent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRule', () => {
    it('should delete when not system rule', async () => {
      (ruleRepo.findOne as jest.Mock).mockResolvedValue(mockRule);
      await service.deleteRule(userId, ruleId);
      expect(ruleRepo.remove).toHaveBeenCalledWith(mockRule);
    });

    it('should throw BadRequestException when system rule', async () => {
      (ruleRepo.findOne as jest.Mock).mockResolvedValue({ ...mockRule, isSystem: true });
      await expect(service.deleteRule(userId, ruleId)).rejects.toThrow(
        BadRequestException,
      );
      expect(ruleRepo.remove).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when rule not found', async () => {
      (ruleRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.deleteRule(userId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reorderRules', () => {
    it('should update priority by ordered ids', async () => {
      const r1 = { ...mockRule, id: 'r1' };
      const r2 = { ...mockRule, id: 'r2' };
      (ruleRepo.find as jest.Mock).mockResolvedValue([r1, r2]);
      (ruleRepo.save as jest.Mock).mockImplementation((r) => Promise.resolve(r));
      await service.reorderRules(userId, ['r2', 'r1']);
      expect(ruleRepo.save).toHaveBeenCalledTimes(2);
      expect((ruleRepo.save as jest.Mock).mock.calls[0][0]).toMatchObject({ id: 'r2', priority: 1 });
      expect((ruleRepo.save as jest.Mock).mock.calls[1][0]).toMatchObject({ id: 'r1', priority: 2 });
    });
  });

  describe('simulate', () => {
    it('should return simulation result with steps', async () => {
      const dto = {
        contactId,
        incomingMessage: '明天下午有时间吗？',
        platform: 'wechat' as const,
      };
      const result = await service.simulate(userId, dto);
      expect(contactService.findOneOrFail).toHaveBeenCalledWith(userId, contactId);
      expect(ruleRepo.find).toHaveBeenCalledWith({
        where: { userId },
        order: { priority: 'ASC' },
      });
      expect(result.finalAction).toBe('auto_reply');
      expect(result.matchedRuleName).toBe('白名单自动回复');
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should call routingStats.getStats with user_id and query', async () => {
      await service.getStats(userId, { period: 'week' });
      expect(routingStats.getStats).toHaveBeenCalledWith(
        userId,
        'week',
        undefined,
        undefined,
      );
    });
  });

  describe('updateLogReply', () => {
    it('should update log replyRecordId and replySentContent', async () => {
      (logRepo.findOne as jest.Mock).mockResolvedValue(mockLog);
      (logRepo.save as jest.Mock).mockImplementation((x) => Promise.resolve(x));
      await service.updateLogReply(userId, logId, 'reply-1', '已回复内容');
      expect(logRepo.findOne).toHaveBeenCalledWith({ where: { id: logId, userId } });
      expect(mockLog.replyRecordId).toBe('reply-1');
      expect(mockLog.replySentContent).toBe('已回复内容');
    });

    it('should throw when log not found', async () => {
      (logRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateLogReply(userId, 'non-existent', 'r1', 'content'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('processInboundMessage', () => {
    it('should create contact, message, run route, and return result', async () => {
      const msgContactService = moduleRef.get<ContactService>(ContactService);
      const messageService = moduleRef.get<MessageService>(MessageService);
      const routeExecutor = moduleRef.get<RouteExecutorService>(RouteExecutorService);
      (msgContactService.findOrCreateByPlatform as jest.Mock).mockResolvedValue({
        id: contactId,
        nickname: 'Test',
        level: 'normal',
        isWhitelist: true,
        isBlacklist: false,
        tags: [],
      });
      (messageService.createIncoming as jest.Mock).mockResolvedValue({
        id: 'msg-new',
      });
      (routeExecutor.execute as jest.Mock).mockResolvedValue({
        action: 'auto_reply',
        routingLogId: logId,
        sceneId: 'scene-1',
        profileId: 'profile-1',
      });
      const replyService = moduleRef.get<ReplyService>(ReplyService);
      (replyService.generate as jest.Mock).mockResolvedValue({
        replyId: 'reply-new',
      });
      (replyService.review as jest.Mock).mockResolvedValue({
        status: 'sent',
        sentContent: '好的',
      });
      (logRepo.findOne as jest.Mock).mockResolvedValue(mockLog);
      (logRepo.save as jest.Mock).mockResolvedValue(mockLog);

      const result = await service.processInboundMessage(userId, {
        platform: 'wechat',
        platformContactId: 'openid-1',
        nickname: 'Test',
        content: '你好',
      });

      expect(msgContactService.findOrCreateByPlatform).toHaveBeenCalledWith(
        userId,
        'wechat',
        'openid-1',
        'Test',
      );
      expect(messageService.createIncoming).toHaveBeenCalledWith(
        userId,
        contactId,
        'wechat',
        '你好',
        'text',
      );
      expect(result.action).toBe('auto_reply');
      expect(result.messageId).toBe('msg-new');
      expect(result.routingLogId).toBe(logId);
      expect(result.replyRecordId).toBe('reply-new');
      expect(result.sentContent).toBe('好的');
    });
  });
});
