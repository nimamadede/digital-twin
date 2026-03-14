import {
  Controller,
  Get,
  Post,
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
import { MessageService } from './message.service';
import { MessageStatsService } from './services/message-stats.service';
import { MessageQueryDto } from './dto/message-query.dto';
import {
  ConversationListQueryDto,
  ConversationDetailQueryDto,
} from './dto/conversation-query.dto';
import { MessageStatsQueryDto } from './dto/stats-query.dto';
import { ExportMessagesDto } from './dto/export-messages.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly messageStatsService: MessageStatsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get message list with filters' })
  @ApiResponse({ status: 200, description: 'Paginated message list' })
  async getList(
    @CurrentUser('sub') userId: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.messageService.getList(userId, query);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get conversation list (recent sessions)' })
  @ApiResponse({ status: 200, description: 'Paginated conversation list' })
  async getConversations(
    @CurrentUser('sub') userId: string,
    @Query() query: ConversationListQueryDto,
  ) {
    return this.messageService.getConversations(userId, query);
  }

  @Get('conversations/:contactId')
  @ApiOperation({ summary: 'Get conversation detail with a contact' })
  @ApiResponse({ status: 200, description: 'Paginated messages with contact' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getConversationDetail(
    @CurrentUser('sub') userId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Query() query: ConversationDetailQueryDto,
  ) {
    return this.messageService.getConversationDetail(
      userId,
      contactId,
      query,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get message statistics' })
  @ApiResponse({ status: 200, description: 'Stats summary, timeline, top contacts' })
  async getStats(
    @CurrentUser('sub') userId: string,
    @Query() query: MessageStatsQueryDto,
  ) {
    return this.messageStatsService.getStats(userId, query);
  }

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create message export task' })
  @ApiResponse({ status: 202, description: 'Export task created' })
  async exportMessages(
    @CurrentUser('sub') userId: string,
    @Body() dto: ExportMessagesDto,
  ) {
    const result = await this.messageService.createExportTask(userId, dto);
    return {
      message: '导出任务已创建',
      data: result,
    };
  }

  @Get('export/:taskId')
  @ApiOperation({ summary: 'Get export task status and download URL' })
  @ApiResponse({ status: 200, description: 'Task status and download URL if completed' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getExportTask(
    @CurrentUser('sub') userId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.messageService.getExportTask(userId, taskId);
  }
}
