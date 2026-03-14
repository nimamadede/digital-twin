import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MessageService } from './message.service';
import { Message } from './entities/message.entity';
import { MessageExportTask } from './entities/message-export-task.entity';
import { ContactService } from '../contact/contact.service';
import { StorageService } from '../storage/storage.service';
import { MESSAGE_EXPORT_QUEUE_NAME } from './processors/message-export.processor';

const userId = 'user-uuid-1';
const contactId = 'contact-uuid-1';
const taskId = 'task-uuid-1';

const mockMessage = {
  id: 'msg-uuid-1',
  userId,
  contactId,
  direction: 'incoming',
  content: '你好',
  msgType: 'text',
  platform: 'wechat',
  isAiGenerated: false,
  replyRecordId: null,
  createdAt: new Date(),
  contact: { id: contactId, nickname: '张三', avatar: null, platform: 'wechat' },
} as unknown as Message;

const mockExportTask = {
  id: taskId,
  userId,
  status: 'completed',
  fileUploadId: 'file-uuid-1',
  errorMessage: null,
  expiresAt: new Date(),
  fileUpload: { fileSize: '1024' },
} as unknown as MessageExportTask;

describe('MessageService', () => {
  let service: MessageService;
  let messageRepo: Repository<Message>;
  let exportTaskRepo: Repository<MessageExportTask>;
  let contactService: ContactService;
  let storageService: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: getRepositoryToken(Message),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              offset: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[mockMessage], 1]),
              getMany: jest.fn().mockResolvedValue([mockMessage]),
            })),
            count: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: getRepositoryToken(MessageExportTask),
          useValue: {
            create: jest.fn((dto) => ({ ...dto, id: taskId })),
            save: jest.fn().mockImplementation((t) => Promise.resolve(t)),
            findOne: jest.fn().mockResolvedValue(mockExportTask),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ContactService,
          useValue: { findOneOrFail: jest.fn().mockResolvedValue({ id: contactId, nickname: '张三' }) },
        },
        {
          provide: StorageService,
          useValue: {
            getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://example.com/download'),
          },
        },
        {
          provide: getQueueToken(MESSAGE_EXPORT_QUEUE_NAME),
          useValue: { add: jest.fn().mockResolvedValue({ id: taskId }) },
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    messageRepo = module.get<Repository<Message>>(getRepositoryToken(Message));
    exportTaskRepo = module.get<Repository<MessageExportTask>>(getRepositoryToken(MessageExportTask));
    contactService = module.get<ContactService>(ContactService);
    storageService = module.get<StorageService>(StorageService);
    jest.clearAllMocks();
  });

  describe('getList', () => {
    it('should return paginated messages with user filter', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockMessage], 1]),
      };
      (messageRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getList(userId, { page: 1, pageSize: 20 });

      expect(messageRepo.createQueryBuilder).toHaveBeenCalledWith('m');
      expect(qb.where).toHaveBeenCalledWith('m.userId = :userId', { userId });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].contactNickname).toBe('张三');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('getConversationDetail', () => {
    it('should return messages for contact with user isolation', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockMessage], 1]),
      };
      (messageRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getConversationDetail(userId, contactId, {
        page: 1,
        pageSize: 50,
      });

      expect(contactService.findOneOrFail).toHaveBeenCalledWith(userId, contactId);
      expect(qb.andWhere).toHaveBeenCalledWith('m.contactId = :contactId', { contactId });
      expect(result.items).toHaveLength(1);
    });

    it('should throw when contact not found', async () => {
      (contactService.findOneOrFail as jest.Mock).mockRejectedValue(new NotFoundException());

      await expect(
        service.getConversationDetail(userId, 'wrong-contact', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createExportTask', () => {
    it('should create task and enqueue job', async () => {
      const result = await service.createExportTask(userId, {
        format: 'csv',
        contactId,
        startDate: '2026-03-01',
        endDate: '2026-03-14',
      });

      expect(exportTaskRepo.save).toHaveBeenCalled();
      expect(result.taskId).toBe(taskId);
      expect(result.estimatedTime).toBe(10);
    });
  });

  describe('getExportTask', () => {
    it('should return task with download URL when completed', async () => {
      const result = await service.getExportTask(userId, taskId);

      expect(exportTaskRepo.findOne).toHaveBeenCalledWith({
        where: { id: taskId, userId },
        relations: ['fileUpload'],
      });
      expect(result.status).toBe('completed');
      expect(result.downloadUrl).toBe('https://example.com/download');
      expect(storageService.getPresignedDownloadUrl).toHaveBeenCalledWith(
        userId,
        'file-uuid-1',
        86400,
      );
    });

    it('should throw when task not found', async () => {
      (exportTaskRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getExportTask(userId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findMessagesForExport', () => {
    it('should return messages with user and optional filters', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockMessage]),
      };
      (messageRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.findMessagesForExport(userId, {
        contactId,
        startDate: '2026-03-01',
        endDate: '2026-03-14',
      });

      expect(qb.where).toHaveBeenCalledWith('m.userId = :userId', { userId });
      expect(result).toHaveLength(1);
    });
  });
});
