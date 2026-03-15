import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './gateways/notification.gateway';
import { Notification } from './entities/notification.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  let repo: Repository<Notification>;
  let gateway: NotificationGateway;

  const userId = 'user-uuid-1';
  const notificationId = 'notif-uuid-1';

  const mockNotification: Notification = {
    id: notificationId,
    userId,
    type: 'warning',
    title: '微信连接断开',
    content: '您的微信连接已断开，请重新扫码授权',
    actionUrl: '/platforms',
    isRead: false,
    metadata: null,
    createdAt: new Date('2026-03-14T10:00:00.000Z'),
  } as Notification;

  const selectQb = () => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockNotification], 1]),
  });
  const updateQb = () => ({
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  });
  const mockRepo = {
    createQueryBuilder: jest.fn((alias?: string) =>
      alias === 'n' ? selectQb() : updateQb(),
    ),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockGateway = {
    emitNotification: jest.fn(),
    emitToUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepo,
        },
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repo = module.get<Repository<Notification>>(getRepositoryToken(Notification));
    gateway = module.get<NotificationGateway>(NotificationGateway);
    jest.clearAllMocks();
  });

  describe('getList', () => {
    it('should filter by userId and return paginated list', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockNotification], 1]),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getList(userId, { page: 1, pageSize: 20 });

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('n');
      expect(qb.where).toHaveBeenCalledWith('n.userId = :userId', { userId });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should apply type and isRead filters when provided', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.getList(userId, {
        page: 1,
        pageSize: 10,
        type: 'warning',
        isRead: false,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('n.type = :type', {
        type: 'warning',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('n.isRead = :isRead', {
        isRead: false,
      });
    });
  });

  describe('getOne', () => {
    it('should return notification when found for userId', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.getOne(userId, notificationId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, userId },
      });
      expect(result.id).toBe(notificationId);
      expect(result.title).toBe('微信连接断开');
      expect(result.createdAt).toBe(mockNotification.createdAt.toISOString());
    });

    it('should throw NotFoundException when not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getOne(userId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create notification and emit via gateway', async () => {
      const dto = {
        type: 'warning' as const,
        title: 'Test',
        content: 'Content',
        actionUrl: '/platforms',
      };
      (repo.create as jest.Mock).mockReturnValue(mockNotification);
      (repo.save as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.create(userId, dto);

      expect(repo.create).toHaveBeenCalledWith({
        userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        actionUrl: dto.actionUrl,
        metadata: null,
      });
      expect(repo.save).toHaveBeenCalledWith(mockNotification);
      expect(mockGateway.emitNotification).toHaveBeenCalledWith(userId, {
        id: mockNotification.id,
        type: mockNotification.type,
        title: mockNotification.title,
        content: mockNotification.content,
        actionUrl: mockNotification.actionUrl,
        timestamp: mockNotification.createdAt.toISOString(),
      });
      expect(result.id).toBe(notificationId);
    });
  });

  describe('markRead', () => {
    it('should mark notification as read', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockNotification);
      const updated = { ...mockNotification, isRead: true };
      (repo.save as jest.Mock).mockResolvedValue(updated);

      const result = await service.markRead(userId, notificationId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, userId },
      });
      expect(mockNotification.isRead).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(mockNotification);
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException when notification not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.markRead(userId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllRead', () => {
    it('should update all unread for userId', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.markAllRead(userId);

      expect(qb.where).toHaveBeenCalledWith('userId = :userId', { userId });
      expect(qb.andWhere).toHaveBeenCalledWith('isRead = :isRead', {
        isRead: false,
      });
      expect(result.updated).toBe(3);
    });
  });

  describe('countUnread', () => {
    it('should return count of unread for userId', async () => {
      (repo.count as jest.Mock).mockResolvedValue(5);

      const result = await service.countUnread(userId);

      expect(repo.count).toHaveBeenCalledWith({
        where: { userId, isRead: false },
      });
      expect(result).toBe(5);
    });
  });
});
