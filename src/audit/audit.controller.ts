import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: '查询审计日志列表' })
  @ApiResponse({ status: 200, description: '分页审计日志' })
  async getList(
    @CurrentUser('sub') userId: string,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditService.getList(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单条审计日志' })
  @ApiResponse({ status: 200, description: '审计日志详情' })
  @ApiResponse({ status: 404, description: '日志不存在' })
  async getOne(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.auditService.getOne(userId, id);
  }
}
