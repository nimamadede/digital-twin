import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ContactService } from './contact.service';
import { Contact } from './entities/contact.entity';

describe('ContactService', () => {
  let service: ContactService;
  let repo: Repository<Contact>;

  const userId = 'user-uuid-1';
  const contactId = 'contact-uuid-1';

  const mockContact: Contact = {
    id: contactId,
    userId,
    platformId: 'wxid_xxx',
    platform: 'wechat',
    nickname: '张三',
    remark: '同事',
    avatar: 'https://example.com/avatar.png',
    level: 'normal',
    isWhitelist: false,
    isBlacklist: false,
    tags: ['同事'],
    customReplyProfileId: null,
    notes: null,
    messageCount: 10,
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Contact;

  const mockRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockContact], 1]),
    })),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(function (this: unknown) {
      return {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        {
          provide: getRepositoryToken(Contact),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
    repo = module.get<Repository<Contact>>(getRepositoryToken(Contact));
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should filter by userId and return paginated list', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockContact], 1]),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.findAll(userId, { page: 1, pageSize: 20 });

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('c');
      expect(qb.where).toHaveBeenCalledWith('c.userId = :userId', { userId });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should apply keyword filter when provided', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.findAll(userId, { keyword: '张' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(c.nickname ILIKE :keyword OR c.remark ILIKE :keyword)',
        { keyword: '%张%' },
      );
    });
  });

  describe('findOneOrFail', () => {
    it('should return contact when found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findOneOrFail(userId, contactId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: contactId, userId },
      });
      expect(result).toEqual(mockContact);
    });

    it('should throw NotFoundException when contact not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOneOrFail(userId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update contact and return saved entity', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockContact);
      const updated = { ...mockContact, level: 'important' };
      (repo.save as jest.Mock).mockResolvedValue(updated);

      const result = await service.update(userId, contactId, {
        level: 'important',
      });

      expect(mockContact.level).toBe('important');
      expect(repo.save).toHaveBeenCalledWith(mockContact);
      expect(result).toEqual(updated);
    });
  });

  describe('batchUpdate', () => {
    it('should update only contacts belonging to userId', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.batchUpdate(userId, [contactId, 'id-2'], {
        level: 'normal',
        isWhitelist: false,
      });

      expect(qb.where).toHaveBeenCalledWith('userId = :userId', { userId });
      expect(qb.andWhereInIds).toHaveBeenCalledWith([contactId, 'id-2']);
      expect(result.updated).toBe(2);
    });

    it('should return updated 0 when no fields to update', async () => {
      const result = await service.batchUpdate(userId, [contactId], {});

      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result.updated).toBe(0);
    });
  });

  describe('whitelist', () => {
    it('addToWhitelist should set isWhitelist true', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockContact);
      (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve(c));

      await service.addToWhitelist(userId, contactId);

      expect(mockContact.isWhitelist).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(mockContact);
    });

    it('removeFromWhitelist should set isWhitelist false', async () => {
      mockContact.isWhitelist = true;
      (repo.findOne as jest.Mock).mockResolvedValue(mockContact);
      (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve(c));

      await service.removeFromWhitelist(userId, contactId);

      expect(mockContact.isWhitelist).toBe(false);
    });
  });

  describe('blacklist', () => {
    it('addToBlacklist should set isBlacklist true', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockContact);
      (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve(c));

      await service.addToBlacklist(userId, contactId);

      expect(mockContact.isBlacklist).toBe(true);
    });

    it('removeFromBlacklist should set isBlacklist false', async () => {
      mockContact.isBlacklist = true;
      (repo.findOne as jest.Mock).mockResolvedValue(mockContact);
      (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve(c));

      await service.removeFromBlacklist(userId, contactId);

      expect(mockContact.isBlacklist).toBe(false);
    });
  });

  describe('createSyncTask', () => {
    it('should return taskId and estimatedCount', async () => {
      const result = await service.createSyncTask(userId, 'platform-auth-uuid');

      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('estimatedCount', 200);
      expect(typeof result.taskId).toBe('string');
    });
  });
});
