import { randomUUID } from 'crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import type { PaginatedResult } from '../common/dto/pagination.dto';
import type { ContactQueryDto } from './dto/contact-query.dto';
import type { UpdateContactDto } from './dto/update-contact.dto';
import type { BatchUpdateFieldsDto } from './dto/batch-update-contacts.dto';

export interface ContactListItem {
  id: string;
  platformId: string;
  platform: string;
  nickname: string;
  remark: string | null;
  avatar: string | null;
  level: string;
  isWhitelist: boolean;
  isBlacklist: boolean;
  tags: string[];
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
}

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
  ) {}

  /**
   * List contacts with user_id isolation. All filters scoped to userId.
   */
  async findAll(
    userId: string,
    query: ContactQueryDto,
  ): Promise<PaginatedResult<ContactListItem>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const qb = this.contactRepo
      .createQueryBuilder('c')
      .where('c.userId = :userId', { userId })
      .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .addOrderBy('c.createdAt', 'DESC');

    if (query.platform) {
      qb.andWhere('c.platform = :platform', { platform: query.platform });
    }
    if (query.level) {
      qb.andWhere('c.level = :level', { level: query.level });
    }
    if (query.isWhitelist === true) {
      qb.andWhere('c.isWhitelist = :isWhitelist', { isWhitelist: true });
    }
    if (query.isBlacklist === true) {
      qb.andWhere('c.isBlacklist = :isBlacklist', { isBlacklist: true });
    }
    if (query.keyword?.trim()) {
      qb.andWhere('(c.nickname ILIKE :keyword OR c.remark ILIKE :keyword)', {
        keyword: `%${query.keyword.trim()}%`,
      });
    }

    const [items, total] = await qb
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((c) => this.toListItem(c)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Find contact by platform + platformId, or create with nickname. User_id isolated.
   * Used when an inbound message arrives from a platform (e.g. WeChat openId).
   */
  async findOrCreateByPlatform(
    userId: string,
    platform: string,
    platformId: string,
    nickname?: string,
  ): Promise<Contact> {
    const existing = await this.contactRepo.findOne({
      where: { userId, platform, platformId },
    });
    if (existing) return existing;
    const contact = this.contactRepo.create({
      userId,
      platformId,
      platform,
      nickname: nickname ?? `Contact ${platformId.slice(0, 8)}`,
    });
    return this.contactRepo.save(contact);
  }

  /**
   * Get one contact by id with user_id isolation.
   */
  async findOne(userId: string, contactId: string): Promise<Contact | null> {
    return this.contactRepo.findOne({
      where: { id: contactId, userId },
    });
  }

  /**
   * Get one or throw NotFound.
   */
  async findOneOrFail(userId: string, contactId: string): Promise<Contact> {
    const contact = await this.findOne(userId, contactId);
    if (!contact) {
      throw new NotFoundException('NOT_FOUND');
    }
    return contact;
  }

  /**
   * Update contact. Enforces user_id isolation.
   */
  async update(
    userId: string,
    contactId: string,
    dto: UpdateContactDto,
  ): Promise<Contact> {
    const contact = await this.findOneOrFail(userId, contactId);
    if (dto.level !== undefined) contact.level = dto.level;
    if (dto.isWhitelist !== undefined) contact.isWhitelist = dto.isWhitelist;
    if (dto.isBlacklist !== undefined) contact.isBlacklist = dto.isBlacklist;
    if (dto.remark !== undefined) contact.remark = dto.remark;
    if (dto.tags !== undefined) contact.tags = dto.tags;
    if (dto.customReplyProfile !== undefined) {
      contact.customReplyProfileId = dto.customReplyProfile || null;
    }
    if (dto.notes !== undefined) contact.notes = dto.notes;
    return this.contactRepo.save(contact);
  }

  /**
   * Batch update contacts. Only updates contacts belonging to userId.
   */
  async batchUpdate(
    userId: string,
    contactIds: string[],
    updates: BatchUpdateFieldsDto,
  ): Promise<{ updated: number }> {
    if (!contactIds.length) {
      throw new BadRequestException('contactIds must not be empty');
    }
    const setFields: {
      level?: string;
      isWhitelist?: boolean;
      isBlacklist?: boolean;
      remark?: string;
      tags?: string[];
    } = {};
    if (updates.level !== undefined) setFields.level = updates.level;
    if (updates.isWhitelist !== undefined)
      setFields.isWhitelist = updates.isWhitelist;
    if (updates.isBlacklist !== undefined)
      setFields.isBlacklist = updates.isBlacklist;
    if (updates.remark !== undefined) setFields.remark = updates.remark;
    if (updates.tags !== undefined) setFields.tags = updates.tags;

    if (Object.keys(setFields).length === 0) {
      return { updated: 0 };
    }

    const result = await this.contactRepo
      .createQueryBuilder()
      .update(Contact)
      .set(setFields)
      .where('userId = :userId', { userId })
      .andWhereInIds(contactIds)
      .execute();
    return { updated: Number(result.affected) ?? 0 };
  }

  /**
   * Add contact to whitelist. User_id isolated.
   */
  async addToWhitelist(userId: string, contactId: string): Promise<Contact> {
    const contact = await this.findOneOrFail(userId, contactId);
    contact.isWhitelist = true;
    return this.contactRepo.save(contact);
  }

  /**
   * Remove contact from whitelist.
   */
  async removeFromWhitelist(userId: string, contactId: string): Promise<Contact> {
    const contact = await this.findOneOrFail(userId, contactId);
    contact.isWhitelist = false;
    return this.contactRepo.save(contact);
  }

  /**
   * Add contact to blacklist.
   */
  async addToBlacklist(userId: string, contactId: string): Promise<Contact> {
    const contact = await this.findOneOrFail(userId, contactId);
    contact.isBlacklist = true;
    return this.contactRepo.save(contact);
  }

  /**
   * Remove contact from blacklist.
   */
  async removeFromBlacklist(userId: string, contactId: string): Promise<Contact> {
    const contact = await this.findOneOrFail(userId, contactId);
    contact.isBlacklist = false;
    return this.contactRepo.save(contact);
  }

  /**
   * Create sync task (stub). Returns 202 with taskId and estimatedCount.
   * Caller must ensure platformAuthId belongs to userId.
   */
  async createSyncTask(
    userId: string,
    platformAuthId: string,
  ): Promise<{ taskId: string; estimatedCount: number }> {
    // Stub: real implementation would enqueue a job and query platform for count
    return {
      taskId: randomUUID(),
      estimatedCount: 200,
    };
  }

  private toListItem(c: Contact): ContactListItem {
    return {
      id: c.id,
      platformId: c.platformId,
      platform: c.platform,
      nickname: c.nickname,
      remark: c.remark,
      avatar: c.avatar,
      level: c.level,
      isWhitelist: c.isWhitelist,
      isBlacklist: c.isBlacklist,
      tags: c.tags ?? [],
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      messageCount: c.messageCount,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
