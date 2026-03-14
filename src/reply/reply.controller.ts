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
import { ReplyService } from './reply.service';
import { GenerateReplyDto } from './dto/generate-reply.dto';
import { ReviewReplyDto } from './dto/review-reply.dto';
import { ReplyFeedbackDto } from './dto/reply-feedback.dto';
import { ReplyHistoryQueryDto } from './dto/reply-history-query.dto';
import { PendingReplyQueryDto } from './dto/pending-reply-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('replies')
@ApiBearerAuth()
@Controller('replies')
export class ReplyController {
  constructor(private readonly replyService: ReplyService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate AI reply candidates (manual trigger)' })
  @ApiResponse({ status: 200, description: 'Generated candidates and reply record id' })
  @ApiResponse({ status: 400, description: 'Invalid input or missing contactId' })
  async generate(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateReplyDto,
  ) {
    return this.replyService.generate(userId, dto);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending review reply list' })
  @ApiResponse({ status: 200, description: 'Paginated pending replies' })
  async getPending(
    @CurrentUser('sub') userId: string,
    @Query() query: PendingReplyQueryDto,
  ) {
    return this.replyService.getPending(userId, query);
  }

  @Post(':replyId/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review reply (approve / reject / edit)' })
  @ApiResponse({ status: 200, description: 'Review result with status and sent content' })
  @ApiResponse({ status: 404, description: 'Reply not found' })
  async review(
    @CurrentUser('sub') userId: string,
    @Param('replyId', ParseUUIDPipe) replyId: string,
    @Body() dto: ReviewReplyDto,
  ) {
    const result = await this.replyService.review(userId, replyId, dto);
    return {
      message:
        result.status === 'sent' || result.status === 'edited'
          ? '回复已发送'
          : '已拒绝',
      data: result,
    };
  }

  @Post(':replyId/feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit feedback for a reply' })
  @ApiResponse({ status: 200, description: 'Feedback recorded' })
  @ApiResponse({ status: 404, description: 'Reply not found' })
  async feedback(
    @CurrentUser('sub') userId: string,
    @Param('replyId', ParseUUIDPipe) replyId: string,
    @Body() dto: ReplyFeedbackDto,
  ) {
    await this.replyService.submitFeedback(userId, replyId, dto);
    return { message: 'OK' };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get reply history' })
  @ApiResponse({ status: 200, description: 'Paginated reply history' })
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: ReplyHistoryQueryDto,
  ) {
    return this.replyService.getHistory(userId, query);
  }
}
