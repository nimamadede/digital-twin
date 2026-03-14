import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { ContactQueryDto } from './dto/contact-query.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { BatchUpdateContactsDto } from './dto/batch-update-contacts.dto';
import { SyncContactsDto } from './dto/sync-contacts.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'Get contact list with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated contact list' })
  async list(
    @CurrentUser('sub') userId: string,
    @Query() query: ContactQueryDto,
  ) {
    return this.contactService.findAll(userId, query);
  }

  @Get(':contactId')
  @ApiOperation({ summary: 'Get contact detail by id' })
  @ApiResponse({ status: 200, description: 'Contact detail' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getOne(
    @CurrentUser('sub') userId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    const contact = await this.contactService.findOneOrFail(userId, contactId);
    return {
      id: contact.id,
      platformId: contact.platformId,
      platform: contact.platform,
      nickname: contact.nickname,
      remark: contact.remark,
      avatar: contact.avatar,
      level: contact.level,
      isWhitelist: contact.isWhitelist,
      isBlacklist: contact.isBlacklist,
      tags: contact.tags ?? [],
      customReplyProfile: contact.customReplyProfileId,
      notes: contact.notes,
      lastMessageAt: contact.lastMessageAt?.toISOString() ?? null,
      messageCount: contact.messageCount,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }

  @Put('batch')
  @ApiOperation({ summary: 'Batch update contacts' })
  @ApiResponse({ status: 200, description: 'Update result with updated count' })
  async batchUpdate(
    @CurrentUser('sub') userId: string,
    @Body() dto: BatchUpdateContactsDto,
  ) {
    return this.contactService.batchUpdate(
      userId,
      dto.contactIds,
      dto.updates,
    );
  }

  @Put(':contactId')
  @ApiOperation({ summary: 'Update contact' })
  @ApiResponse({ status: 200, description: 'Updated contact' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactService.update(userId, contactId, dto);
  }


  @Post(':contactId/whitelist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add contact to whitelist' })
  @ApiResponse({ status: 200, description: 'Contact added to whitelist' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async addToWhitelist(
    @CurrentUser('sub') userId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.contactService.addToWhitelist(userId, contactId);
  }

  @Delete(':contactId/whitelist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove contact from whitelist' })
  @ApiResponse({ status: 200, description: 'Contact removed from whitelist' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async removeFromWhitelist(
    @CurrentUser('sub') userId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.contactService.removeFromWhitelist(userId, contactId);
  }

  @Post(':contactId/blacklist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add contact to blacklist' })
  @ApiResponse({ status: 200, description: 'Contact added to blacklist' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async addToBlacklist(
    @CurrentUser('sub') userId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.contactService.addToBlacklist(userId, contactId);
  }

  @Delete(':contactId/blacklist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove contact from blacklist' })
  @ApiResponse({ status: 200, description: 'Contact removed from blacklist' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async removeFromBlacklist(
    @CurrentUser('sub') userId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.contactService.removeFromBlacklist(userId, contactId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create contact sync task from platform' })
  @ApiResponse({
    status: 202,
    description: 'Sync task created, returns taskId and estimatedCount',
  })
  async sync(
    @CurrentUser('sub') userId: string,
    @Body() dto: SyncContactsDto,
  ) {
    const data = await this.contactService.createSyncTask(
      userId,
      dto.platformAuthId,
    );
    return { message: '同步任务已创建', data };
  }
}
