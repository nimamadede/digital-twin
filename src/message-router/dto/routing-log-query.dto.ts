import { IsOptional, IsString, IsIn, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

const ACTION_VALUES = [
  'auto_reply',
  'pending_review',
  'blocked',
  'ignored',
  'manual',
] as const;

export class RoutingLogQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by contact ID' })
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional({
    enum: ACTION_VALUES,
    description: 'Filter by route action',
  })
  @IsOptional()
  @IsIn(ACTION_VALUES)
  action?: (typeof ACTION_VALUES)[number];

  @ApiPropertyOptional({ description: 'Filter by scene ID' })
  @IsOptional()
  @IsString()
  sceneId?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
