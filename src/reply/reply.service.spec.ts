import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReplyService } from './reply.service';
import { ReplyRecord } from './entities/reply-record.entity';
import { UserSettings } from '../user/entities/user-settings.entity';
import { ContactService } from '../contact/contact.service';
import { StyleService } from '../style/style.service';
import { SceneService } from '../scene/scene.service';
import { AiEngineService } from './services/ai-engine.service';
import { PromptBuilderService } from './services/prompt-builder.service';

const userId = 'user-uuid-1';
const contactId = 'contact-uuid-1';
const replyId = 'reply-uuid-1';

const mockContact = {
  id: contactId,
  userId,
  nickname: '张三',
  platform: 'wechat',
  customReplyProfileId: null,
} as unknown as { id: string; userId: string; nickname: string; platform: string; customReplyProfileId: string | null };

const mockCandidates = [
  { index: 0, content: '好呀！明天下午没事', confidence: 0.92 },
  { index: 1, content: '可以呀，几点呢？', confidence: 0.85 },
];

const mockReplyRecord = {
  id: replyId,
  userId,
  contactId,
  profileId: null,
  sceneId: null,
  incomingMessageId: null,
  incomingContent: '明天下午有时间吗？',
  candidates: mockCandidates,
  selectedIndex: null,
  sentContent: null,
  status: 'pending',
  feedbackRating: null,
  feedbackTag: null,
  feedbackComment: null,
  reviewedAt: null,
  sentAt: null,
  expiresAt: new Date(),
  createdAt: new Date(),
  contact: { id: contactId, nickname: '张三', platform: 'wechat' } as never,
} as unknown as ReplyRecord;

describe('ReplyService', () => {
  let service: ReplyService;
  let replyRepo: Repository<ReplyRecord>;
  let settingsRepo: Repository<UserSettings>;
  let contactService: ContactService;
  let styleService: StyleService;
  let sceneService: SceneService;
  let aiEngine: AiEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplyService,
        {
          provide: getRepositoryToken(ReplyRecord),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[mockReplyRecord], 1]),
            })),
          },
        },
        {
          provide: getRepositoryToken(UserSettings),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              userId,
              defaultProfileId: null,
              defaultSceneId: null,
              reviewTimeout: 300,
            }),
          },
        },
        {
          provide: ContactService,
          useValue: { findOneOrFail: jest.fn().mockResolvedValue(mockContact) },
        },
        {
          provide: StyleService,
          useValue: {
            findOneProfileOrFail: jest.fn().mockResolvedValue({
              id: 'profile-1',
              traits: { tone: 'friendly' },
            }),
            findOne: jest.fn(),
          },
        },
        {
          provide: SceneService,
          useValue: {
            findActive: jest.fn().mockResolvedValue(null),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: AiEngineService,
          useValue: {
            generateCandidates: jest.fn().mockResolvedValue(mockCandidates),
          },
        },
        PromptBuilderService,
      ],
    }).compile();

    service = module.get<ReplyService>(ReplyService);
    replyRepo = module.get<Repository<ReplyRecord>>(getRepositoryToken(ReplyRecord));
    settingsRepo = module.get<Repository<UserSettings>>(getRepositoryToken(UserSettings));
    contactService = module.get<ContactService>(ContactService);
    styleService = module.get<StyleService>(StyleService);
    sceneService = module.get<SceneService>(SceneService);
    aiEngine = module.get<AiEngineService>(AiEngineService);
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should require contactId', async () => {
      await expect(
        service.generate(userId, {
          incomingMessage: '你好',
          count: 2,
        } as never),
      ).rejects.toThrow(BadRequestException);
      expect(contactService.findOneOrFail).not.toHaveBeenCalled();
    });

    it('should create pending record with candidates and return result', async () => {
      const created = { ...mockReplyRecord, id: 'new-reply-id' };
      (replyRepo.create as jest.Mock).mockReturnValue(created);
      (replyRepo.save as jest.Mock).mockResolvedValue(created);

      const result = await service.generate(userId, {
        incomingMessage: '明天下午有时间吗？',
        contactId,
        count: 2,
      });

      expect(contactService.findOneOrFail).toHaveBeenCalledWith(userId, contactId);
      expect(aiEngine.generateCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          incomingMessage: '明天下午有时间吗？',
          contactNickname: '张三',
        }),
        2,
      );
      expect(replyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          contactId,
          incomingContent: '明天下午有时间吗？',
          candidates: mockCandidates,
          status: 'pending',
        }),
      );
      expect(replyRepo.save).toHaveBeenCalledWith(created);
      expect(result.replyId).toBe('new-reply-id');
      expect(result.candidates).toEqual(mockCandidates);
      expect(result.expiresAt).toBe(created.expiresAt.toISOString());
    });
  });

  describe('findOneOrFail', () => {
    it('should return record when found', async () => {
      (replyRepo.findOne as jest.Mock).mockResolvedValue(mockReplyRecord);

      const result = await service.findOneOrFail(userId, replyId);

      expect(replyRepo.findOne).toHaveBeenCalledWith({
        where: { id: replyId, userId },
      });
      expect(result).toEqual(mockReplyRecord);
    });

    it('should throw NotFoundException when not found', async () => {
      (replyRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOneOrFail(userId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('review', () => {
    it('should approve and set sent content', async () => {
      const record = { ...mockReplyRecord, status: 'pending' as const };
      (replyRepo.findOne as jest.Mock).mockResolvedValue(record);
      (replyRepo.save as jest.Mock).mockImplementation((r) => Promise.resolve(r));

      const result = await service.review(userId, replyId, {
        action: 'approve',
        selectedIndex: 0,
      });

      expect(record.status).toBe('sent');
      expect(record.sentContent).toBe('好呀！明天下午没事');
      expect(record.selectedIndex).toBe(0);
      expect(record.reviewedAt).toBeDefined();
      expect(record.sentAt).toBeDefined();
      expect(replyRepo.save).toHaveBeenCalledWith(record);
      expect(result.status).toBe('sent');
      expect(result.sentContent).toBe('好呀！明天下午没事');
    });

    it('should reject and set status rejected', async () => {
      const record = { ...mockReplyRecord, status: 'pending' as const };
      (replyRepo.findOne as jest.Mock).mockResolvedValue(record);
      (replyRepo.save as jest.Mock).mockImplementation((r) => Promise.resolve(r));

      const result = await service.review(userId, replyId, {
        action: 'reject',
      });

      expect(record.status).toBe('rejected');
      expect(record.reviewedAt).toBeDefined();
      expect(result.status).toBe('rejected');
      expect(result.sentContent).toBeNull();
    });

    it('should edit and set edited content', async () => {
      const record = { ...mockReplyRecord, status: 'pending' as const };
      (replyRepo.findOne as jest.Mock).mockResolvedValue(record);
      (replyRepo.save as jest.Mock).mockImplementation((r) => Promise.resolve(r));

      const result = await service.review(userId, replyId, {
        action: 'edit',
        editedContent: ' 我明天再回复你吧 ',
      });

      expect(record.status).toBe('edited');
      expect(record.sentContent).toBe('我明天再回复你吧');
      expect(result.status).toBe('edited');
    });

    it('should throw when reply is not pending', async () => {
      (replyRepo.findOne as jest.Mock).mockResolvedValue({
        ...mockReplyRecord,
        status: 'sent',
      });

      await expect(
        service.review(userId, replyId, { action: 'approve', selectedIndex: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when approve without valid selectedIndex', async () => {
      const record = { ...mockReplyRecord, status: 'pending' as const };
      (replyRepo.findOne as jest.Mock).mockResolvedValue(record);

      await expect(
        service.review(userId, replyId, { action: 'approve' }),
      ).rejects.toThrow(BadRequestException);

      (replyRepo.findOne as jest.Mock).mockResolvedValue({ ...record });
      await expect(
        service.review(userId, replyId, {
          action: 'approve',
          selectedIndex: 99,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitFeedback', () => {
    it('should update feedback fields', async () => {
      const record = { ...mockReplyRecord };
      (replyRepo.findOne as jest.Mock).mockResolvedValue(record);
      (replyRepo.save as jest.Mock).mockImplementation((r) => Promise.resolve(r));

      await service.submitFeedback(userId, replyId, {
        rating: 4,
        feedback: 'tone_mismatch',
        comment: '语气稍微正式了一些',
      });

      expect(record.feedbackRating).toBe(4);
      expect(record.feedbackTag).toBe('tone_mismatch');
      expect(record.feedbackComment).toBe('语气稍微正式了一些');
      expect(replyRepo.save).toHaveBeenCalledWith(record);
    });
  });

  describe('getPending', () => {
    it('should return paginated pending replies for user', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockReplyRecord], 1]),
      };
      (replyRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getPending(userId, { page: 1, pageSize: 20 });

      expect(replyRepo.createQueryBuilder).toHaveBeenCalledWith('r');
      expect(qb.where).toHaveBeenCalledWith('r.userId = :userId', { userId });
      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', {
        status: 'pending',
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(replyId);
      expect(result.items[0].contact.nickname).toBe('张三');
      expect(result.total).toBe(1);
    });
  });

  describe('getHistory', () => {
    it('should return paginated history with user filter', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockReplyRecord], 1]),
      };
      (replyRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getHistory(userId, {
        page: 1,
        pageSize: 20,
        status: 'sent',
      });

      expect(replyRepo.createQueryBuilder).toHaveBeenCalledWith('r');
      expect(qb.where).toHaveBeenCalledWith('r.userId = :userId', { userId });
      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', {
        status: 'sent',
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });
});
