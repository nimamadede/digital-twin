import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

const userId = 'user-uuid-1';
const logId = 'log-uuid-1';

const mockAuditLog = {
  id: logId,
  userId,
  action: 'scene.create',
  resourceType: 'scenes',
  resourceId: 'scene-uuid-1',
  details: { name: '工作模式' },
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  createdAt: new Date('2026-03-15T10:00:00.000Z'),
} as unknown as AuditLog;

describe('AuditService', () => {
  let service: AuditService;
  let repo: Repository<AuditLog>;

  const mockRepo = {
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repo = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create and save an audit log entry', async () => {
      await service.log({
        userId,
        action: 'scene.create',
        resourceType: 'scenes',
        resourceId: 'scene-uuid-1',
        details: { name: '工作模式' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(repo.create).toHaveBeenCalledWith({
        userId,
        action: 'scene.create',
        resourceType: 'scenes',
        resourceId: 'scene-uuid-1',
        details: { name: '工作模式' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });
      expect(repo.save).toHaveBeenCalled();
    });

    it('should default nullable fields to null', async () => {
      await service.log({
        userId: null,
        action: 'user.register',
        resourceType: 'users',
      });

      expect(repo.create).toHaveBeenCalledWith({
        userId: null,
        action: 'user.register',
        resourceType: 'users',
        resourceId: null,
        details: null,
        ipAddress: null,
        userAgent: null,
      });
    });
  });

  describe('getList', () => {
    it('should return paginated audit logs filtered by userId', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAuditLog], 1]),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getList(userId, { page: 1, pageSize: 20 });

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('a');
      expect(qb.where).toHaveBeenCalledWith('a.userId = :userId', { userId });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(logId);
      expect(result.items[0].action).toBe('scene.create');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should apply action and resourceType filters', async () => {
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
        action: 'reply.approve',
        resourceType: 'replies',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('a.action = :action', {
        action: 'reply.approve',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'a.resourceType = :resourceType',
        { resourceType: 'replies' },
      );
    });

    it('should apply date range filters', async () => {
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
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt >= :startDate', {
        startDate: '2026-03-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt <= :endDate', {
        endDate: '2026-03-15',
      });
    });
  });

  describe('getOne', () => {
    it('should return audit log when found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockAuditLog);

      const result = await service.getOne(userId, logId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: logId, userId },
      });
      expect(result.id).toBe(logId);
      expect(result.action).toBe('scene.create');
      expect(result.resourceType).toBe('scenes');
      expect(result.createdAt).toBe('2026-03-15T10:00:00.000Z');
    });

    it('should throw NotFoundException when not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getOne(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
