import { IsOptional, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

const NOTIFICATION_TYPES = ['info', 'warning', 'error', 'success'] as const;

export class NotificationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES, description: 'Filter by type' })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: (typeof NOTIFICATION_TYPES)[number];

  @ApiPropertyOptional({ description: 'Filter by read status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRead?: boolean;
}
