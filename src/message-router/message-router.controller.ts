import {
  Controller,
  Get,
  Post,
  Put,
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
import { MessageRouterService } from './message-router.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoutingLogQueryDto } from './dto/routing-log-query.dto';
import { CreateRoutingRuleDto } from './dto/create-routing-rule.dto';
import { UpdateRoutingRuleDto } from './dto/update-routing-rule.dto';
import { ReorderRulesDto } from './dto/reorder-rules.dto';
import { SimulateRouteDto } from './dto/simulate-route.dto';
import { RouterStatsQueryDto } from './dto/stats-query.dto';
import { InboundMessageDto } from './dto/inbound-message.dto';

@ApiTags('router')
@ApiBearerAuth()
@Controller('router')
export class MessageRouterController {
  constructor(private readonly messageRouterService: MessageRouterService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get router dashboard (status, today stats, platforms)' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getDashboard(@CurrentUser('sub') userId: string) {
    return this.messageRouterService.getDashboard(userId);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get routing logs list with filters' })
  @ApiResponse({ status: 200, description: 'Paginated routing logs' })
  async getLogs(
    @CurrentUser('sub') userId: string,
    @Query() query: RoutingLogQueryDto,
  ) {
    return this.messageRouterService.getLogs(userId, query);
  }

  @Get('logs/:logId')
  @ApiOperation({ summary: 'Get routing log detail' })
  @ApiResponse({ status: 200, description: 'Routing log detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getLogById(
    @CurrentUser('sub') userId: string,
    @Param('logId', ParseUUIDPipe) logId: string,
  ) {
    return this.messageRouterService.getLogById(userId, logId);
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get all routing rules (by priority)' })
  @ApiResponse({ status: 200, description: 'List of routing rules' })
  async getRules(@CurrentUser('sub') userId: string) {
    return this.messageRouterService.getRules(userId);
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create routing rule' })
  @ApiResponse({ status: 201, description: 'Rule created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createRule(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateRoutingRuleDto,
  ) {
    const result = await this.messageRouterService.createRule(userId, dto);
    return { message: '路由规则已创建', data: result };
  }

  @Put('rules/reorder')
  @ApiOperation({ summary: 'Reorder rules by priority' })
  @ApiResponse({ status: 200, description: 'Rules reordered' })
  async reorderRules(
    @CurrentUser('sub') userId: string,
    @Body() dto: ReorderRulesDto,
  ) {
    await this.messageRouterService.reorderRules(userId, dto.orderedIds);
    return { message: '优先级已更新' };
  }

  @Put('rules/:ruleId')
  @ApiOperation({ summary: 'Update routing rule' })
  @ApiResponse({ status: 200, description: 'Rule updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async updateRule(
    @CurrentUser('sub') userId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateRoutingRuleDto,
  ) {
    return this.messageRouterService.updateRule(userId, ruleId, dto);
  }

  @Delete('rules/:ruleId')
  @ApiOperation({ summary: 'Delete routing rule (system rules cannot be deleted)' })
  @ApiResponse({ status: 200, description: 'Rule deleted' })
  @ApiResponse({ status: 400, description: 'System rule cannot be deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteRule(
    @CurrentUser('sub') userId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    await this.messageRouterService.deleteRule(userId, ruleId);
    return { message: '路由规则已删除' };
  }

  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process inbound platform message (self-test / webhook)',
    description:
      'Simulates platform push: create contact/message -> route -> generate reply -> auto send or pending review',
  })
  @ApiResponse({ status: 200, description: 'Routing result and optional replyRecordId/sentContent' })
  async processInbound(
    @CurrentUser('sub') userId: string,
    @Body() dto: InboundMessageDto,
  ) {
    return this.messageRouterService.processInboundMessage(userId, dto);
  }

  @Post('simulate')
  @ApiOperation({ summary: 'Simulate routing (no actual send)' })
  @ApiResponse({ status: 200, description: 'Simulation result with steps' })
  async simulate(
    @CurrentUser('sub') userId: string,
    @Body() dto: SimulateRouteDto,
  ) {
    return this.messageRouterService.simulate(userId, dto);
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause message routing' })
  @ApiResponse({ status: 200, description: 'Router paused' })
  async pause(@CurrentUser('sub') userId: string) {
    const data = this.messageRouterService.pause(userId);
    return { message: '消息路由已暂停', data };
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume message routing' })
  @ApiResponse({ status: 200, description: 'Router resumed' })
  async resume(@CurrentUser('sub') userId: string) {
    const data = this.messageRouterService.resume(userId);
    return { message: '消息路由已恢复', data };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get routing statistics' })
  @ApiResponse({ status: 200, description: 'Stats by period' })
  async getStats(
    @CurrentUser('sub') userId: string,
    @Query() query: RouterStatsQueryDto,
  ) {
    return this.messageRouterService.getStats(userId, query);
  }
}
