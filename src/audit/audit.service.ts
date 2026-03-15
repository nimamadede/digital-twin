import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto';
import type { PaginatedResult } from '../common/dto/pagination.dto';

export interface CreateAuditLogParams {
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(params: CreateAuditLogParams): Promise<void> {
    const entry = this.auditRepo.create({
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
    await this.auditRepo.save(entry);
  }

  async getList(
    userId: string,
    query: AuditLogQueryDto,
  ): Promise<PaginatedResult<AuditLogItem>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .orderBy('a.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (query.action) {
      qb.andWhere('a.action = :action', { action: query.action });
    }
    if (query.resourceType) {
      qb.andWhere('a.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    }
    if (query.startDate) {
      qb.andWhere('a.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query.endDate) {
      qb.andWhere('a.createdAt <= :endDate', { endDate: query.endDate });
    }

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((a) => this.toItem(a)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getOne(userId: string, id: string): Promise<AuditLogItem> {
    const entry = await this.auditRepo.findOne({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException('NOT_FOUND');
    return this.toItem(entry);
  }

  private toItem(a: AuditLog): AuditLogItem {
    return {
      id: a.id,
      userId: a.userId,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      details: a.details,
      ipAddress: a.ipAddress,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
