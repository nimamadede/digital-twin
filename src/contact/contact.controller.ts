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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { ContactQueryDto } from './dto/contact-query.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { BatchUpdateContactsDto } from './dto/batch-update-contacts.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';
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

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import contacts from CSV or JSON file' })
  @ApiResponse({ status: 200, description: 'Import result with created/skipped counts' })
  async importContacts(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportContactsDto,
  ) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'json'].includes(ext)) {
      throw new BadRequestException('Only .csv and .json files are supported');
    }
    const content = file.buffer.toString('utf-8');
    const rows = ext === 'csv'
      ? this.contactService.parseCSV(content)
      : this.contactService.parseJSON(content);

    if (!rows.length) {
      throw new BadRequestException('File contains no valid contact data');
    }

    const result = await this.contactService.importContacts(
      userId,
      dto.platform,
      rows,
      dto.defaultLevel,
    );
    return { message: `导入完成: 新增${result.created}, 跳过${result.skipped}`, data: result };
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
