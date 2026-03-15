import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationGateway } from './gateways/notification.gateway';
import type { PaginatedResult } from '../common/dto/pagination.dto';
import type { NotificationQueryDto } from './dto/notification-query.dto';
import type { CreateNotificationDto } from './dto/create-notification.dto';

export interface NotificationListItem {
  id: string;
  type: string;
  title: string;
  content: string;
  actionUrl: string | null;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * List notifications with user_id isolation. All queries scoped by userId.
   */
  async getList(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<PaginatedResult<NotificationListItem>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (query.type !== undefined) {
      qb.andWhere('n.type = :type', { type: query.type });
    }
    if (query.isRead !== undefined) {
      qb.andWhere('n.isRead = :isRead', { isRead: query.isRead });
    }

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((n) => this.toListItem(n)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get one notification by id, scoped by userId.
   */
  async getOne(userId: string, id: string): Promise<NotificationListItem> {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return this.toListItem(notification);
  }

  /**
   * Create a notification (internal use or admin). Always scoped to userId.
   */
  async create(
    userId: string,
    dto: CreateNotificationDto,
  ): Promise<NotificationListItem> {
    const notification = this.notificationRepo.create({
      userId,
      type: dto.type,
      title: dto.title,
      content: dto.content,
      actionUrl: dto.actionUrl ?? null,
      metadata: dto.metadata ?? null,
    });
    const saved = await this.notificationRepo.save(notification);
    this.notificationGateway.emitNotification(userId, {
      id: saved.id,
      type: saved.type,
      title: saved.title,
      content: saved.content,
      actionUrl: saved.actionUrl,
      timestamp: saved.createdAt.toISOString(),
    });
    return this.toListItem(saved);
  }

  /**
   * Mark a notification as read. Enforces user_id.
   */
  async markRead(userId: string, id: string): Promise<NotificationListItem> {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    notification.isRead = true;
    const saved = await this.notificationRepo.save(notification);
    return this.toListItem(saved);
  }

  /**
   * Mark all notifications as read for the user.
   */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('userId = :userId', { userId })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();
    return { updated: result.affected ?? 0 };
  }

  /**
   * Count unread notifications for user (for badge).
   */
  async countUnread(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  private toListItem(n: Notification): NotificationListItem {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      actionUrl: n.actionUrl,
      isRead: n.isRead,
      metadata: n.metadata,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
