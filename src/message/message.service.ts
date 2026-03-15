import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Message } from './entities/message.entity';
import { MessageExportTask } from './entities/message-export-task.entity';
import { ContactService } from '../contact/contact.service';
import { StorageService } from '../storage/storage.service';
import type { PaginatedResult } from '../common/dto/pagination.dto';
import type { MessageQueryDto } from './dto/message-query.dto';
import type { ConversationDetailQueryDto } from './dto/conversation-query.dto';
import type { ExportMessagesDto } from './dto/export-messages.dto';
import { MESSAGE_EXPORT_QUEUE_NAME } from './constants';

export interface MessageListItem {
  id: string;
  contactId: string;
  contactNickname: string;
  direction: string;
  content: string;
  msgType: string;
  platform: string;
  isAiGenerated: boolean;
  replyRecordId: string | null;
  createdAt: string;
}

export interface ConversationListItem {
  contactId: string;
  contactNickname: string;
  contactAvatar: string | null;
  platform: string;
  lastMessage: {
    content: string;
    direction: string;
    isAiGenerated: boolean;
    createdAt: string;
  };
  unreadCount: number;
  totalMessages: number;
}

export interface ExportTaskCreated {
  taskId: string;
  estimatedTime: number;
}

export interface ExportTaskResult {
  taskId: string;
  status: string;
  downloadUrl: string | null;
  expiresAt: string | null;
  fileSize: number | null;
}

const EXPORT_DOWNLOAD_EXPIRY_SECONDS = 86400; // 24h
const EXPORT_FILE_EXPIRY_SECONDS = 86400 * 7; // 7 days

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(MessageExportTask)
    private readonly exportTaskRepo: Repository<MessageExportTask>,
    private readonly contactService: ContactService,
    private readonly storageService: StorageService,
    @InjectQueue(MESSAGE_EXPORT_QUEUE_NAME)
    private readonly exportQueue: Queue,
  ) {}

  /**
   * Create incoming message (from platform). Used by inbound pipeline. User_id isolated.
   */
  async createIncoming(
    userId: string,
    contactId: string,
    platform: string,
    content: string,
    msgType: string = 'text',
    platformMsgId?: string | null,
  ): Promise<Message> {
    const msg = this.messageRepo.create({
      userId,
      contactId,
      direction: 'incoming',
      content,
      msgType,
      platform,
      platformMsgId: platformMsgId ?? null,
      isAiGenerated: false,
      replyRecordId: null,
    });
    return this.messageRepo.save(msg);
  }

  /**
   * Create outgoing message (sent reply). Links to replyRecordId. User_id isolated.
   */
  async createOutgoing(
    userId: string,
    contactId: string,
    platform: string,
    content: string,
    replyRecordId: string,
    isAiGenerated: boolean = true,
  ): Promise<Message> {
    const msg = this.messageRepo.create({
      userId,
      contactId,
      direction: 'outgoing',
      content,
      msgType: 'text',
      platform,
      platformMsgId: null,
      isAiGenerated,
      replyRecordId,
    });
    return this.messageRepo.save(msg);
  }

  /**
   * Get message list with filters. All queries scoped by userId (data isolation).
   */
  async getList(
    userId: string,
    query: MessageQueryDto,
  ): Promise<PaginatedResult<MessageListItem>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contact', 'c')
      .where('m.userId = :userId', { userId })
      .orderBy('m.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (query.contactId) {
      qb.andWhere('m.contactId = :contactId', { contactId: query.contactId });
    }
    if (query.platform) {
      qb.andWhere('m.platform = :platform', { platform: query.platform });
    }
    if (query.direction) {
      qb.andWhere('m.direction = :direction', { direction: query.direction });
    }
    if (query.msgType) {
      qb.andWhere('m.msgType = :msgType', { msgType: query.msgType });
    }
    if (query.startDate) {
      qb.andWhere('m.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query.endDate) {
      qb.andWhere('m.createdAt <= :endDate', {
        endDate: `${query.endDate}T23:59:59.999Z`,
      });
    }
    if (query.keyword?.trim()) {
      qb.andWhere('m.content ILIKE :keyword', {
        keyword: `%${query.keyword.trim()}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((m) => ({
        id: m.id,
        contactId: m.contactId,
        contactNickname: m.contact?.nickname ?? '',
        direction: m.direction,
        content: m.content,
        msgType: m.msgType,
        platform: m.platform,
        isAiGenerated: m.isAiGenerated,
        replyRecordId: m.replyRecordId,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get conversation detail with a contact (messages). All queries scoped by userId.
   */
  async getConversationDetail(
    userId: string,
    contactId: string,
    query: ConversationDetailQueryDto,
  ): Promise<PaginatedResult<MessageListItem>> {
    await this.contactService.findOneOrFail(userId, contactId);

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const skip = (page - 1) * pageSize;

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contact', 'c')
      .where('m.userId = :userId', { userId })
      .andWhere('m.contactId = :contactId', { contactId })
      .orderBy('m.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (query.before) {
      qb.andWhere('m.createdAt < :before', { before: query.before });
    }

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((m) => ({
        id: m.id,
        contactId: m.contactId,
        contactNickname: m.contact?.nickname ?? '',
        direction: m.direction,
        content: m.content,
        msgType: m.msgType,
        platform: m.platform,
        isAiGenerated: m.isAiGenerated,
        replyRecordId: m.replyRecordId,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get conversation list (recent sessions). All queries scoped by userId.
   */
  async getConversations(
    userId: string,
    query: { page?: number; pageSize?: number },
  ): Promise<PaginatedResult<ConversationListItem>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const totalResult = await this.messageRepo
      .createQueryBuilder('m')
      .select('COUNT(DISTINCT m.contactId)', 'count')
      .where('m.userId = :userId', { userId })
      .getRawOne<{ count: string }>();
    const totalCount = parseInt(totalResult?.count ?? '0', 10);

    const contactRows = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.contactId', 'contactId')
      .addSelect('MAX(m.createdAt)', 'maxCreatedAt')
      .where('m.userId = :userId', { userId })
      .groupBy('m.contactId')
      .orderBy('maxCreatedAt', 'DESC')
      .offset(skip)
      .limit(pageSize)
      .getRawMany<{ contactId: string; maxCreatedAt: Date }>();

    if (contactRows.length === 0) {
      return {
        items: [],
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    }

    const contactIds = contactRows.map((r) => r.contactId);
    const lastMessageMap = new Map(
      contactRows.map((r) => [r.contactId, r.maxCreatedAt]),
    );

    const pairParams = contactRows.reduce(
      (acc, r, i) => ({
        ...acc,
        [`cid${i}`]: r.contactId,
        [`t${i}`]: r.maxCreatedAt,
      }),
      {} as Record<string, string | Date>,
    );
    const messages = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contact', 'c')
      .where('m.userId = :userId', { userId })
      .andWhere(
        contactRows
          .map((_, i) => `(m.contactId = :cid${i} AND m.createdAt = :t${i})`)
          .join(' OR '),
        pairParams,
      )
      .getMany();

    const countResults = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.contactId', 'contactId')
      .addSelect('COUNT(m.id)', 'cnt')
      .where('m.userId = :userId', { userId })
      .andWhere('m.contactId IN (:...contactIds)', { contactIds })
      .groupBy('m.contactId')
      .getRawMany<{ contactId: string; cnt: string }>();
    const countMap = new Map(
      countResults.map((r) => [r.contactId, parseInt(r.cnt, 10)]),
    );

    const messageByContact = new Map(messages.map((m) => [m.contactId, m]));
    const items: ConversationListItem[] = contactIds.map((contactId) => {
      const m = messageByContact.get(contactId);
      return {
        contactId,
        contactNickname: m?.contact?.nickname ?? '',
        contactAvatar: m?.contact?.avatar ?? null,
        platform: m?.platform ?? '',
        lastMessage: m
          ? {
              content: m.content,
              direction: m.direction,
              isAiGenerated: m.isAiGenerated,
              createdAt: m.createdAt.toISOString(),
            }
          : {
              content: '',
              direction: 'incoming',
              isAiGenerated: false,
              createdAt: new Date().toISOString(),
            },
        unreadCount: 0,
        totalMessages: countMap.get(contactId) ?? 0,
      };
    });

    return {
      items,
      total: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  /**
   * Create export task and enqueue job. Returns taskId and estimated time.
   */
  async createExportTask(
    userId: string,
    dto: ExportMessagesDto,
  ): Promise<ExportTaskCreated> {
    const task = this.exportTaskRepo.create({
      userId,
      status: 'pending',
      fileUploadId: null,
      errorMessage: null,
      expiresAt: null,
    });
    const saved = await this.exportTaskRepo.save(task);

    await this.exportQueue.add(
      'export',
      {
        taskId: saved.id,
        userId,
        contactId: dto.contactId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        format: dto.format,
      },
      { jobId: saved.id },
    );

    return {
      taskId: saved.id,
      estimatedTime: 10,
    };
  }

  /**
   * Get export task result and download URL if completed. Enforces userId isolation.
   */
  async getExportTask(userId: string, taskId: string): Promise<ExportTaskResult> {
    const task = await this.exportTaskRepo.findOne({
      where: { id: taskId, userId },
      relations: ['fileUpload'],
    });
    if (!task) {
      throw new NotFoundException('Export task not found');
    }

    let downloadUrl: string | null = null;
    let fileSize: number | null = null;
    if (task.status === 'completed' && task.fileUploadId) {
      downloadUrl = await this.storageService.getPresignedDownloadUrl(
        userId,
        task.fileUploadId,
        EXPORT_DOWNLOAD_EXPIRY_SECONDS,
      );
      if (task.fileUpload) {
        fileSize = parseInt(String(task.fileUpload.fileSize), 10) || null;
      }
    }

    return {
      taskId: task.id,
      status: task.status,
      downloadUrl,
      expiresAt: task.expiresAt?.toISOString() ?? null,
      fileSize,
    };
  }

  /**
   * Used by export processor: find task and update. Enforces userId.
   */
  async findExportTaskOrFail(
    userId: string,
    taskId: string,
  ): Promise<MessageExportTask> {
    const task = await this.exportTaskRepo.findOne({
      where: { id: taskId, userId },
    });
    if (!task) throw new NotFoundException('Export task not found');
    return task;
  }

  /**
   * Used by export processor: stream messages for export. All queries scoped by userId.
   */
  async findMessagesForExport(
    userId: string,
    options: {
      contactId?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<Message[]> {
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.userId = :userId', { userId })
      .orderBy('m.createdAt', 'ASC');

    if (options.contactId) {
      qb.andWhere('m.contactId = :contactId', {
        contactId: options.contactId,
      });
    }
    if (options.startDate) {
      qb.andWhere('m.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }
    if (options.endDate) {
      qb.andWhere('m.createdAt <= :endDate', {
        endDate: `${options.endDate}T23:59:59.999Z`,
      });
    }

    return qb.getMany();
  }
}
