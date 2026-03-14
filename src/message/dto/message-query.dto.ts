import { IsOptional, IsString, IsIn, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

const DIRECTION_VALUES = ['incoming', 'outgoing'] as const;
const MSG_TYPE_VALUES = ['text', 'image', 'voice', 'file', 'system'] as const;

export class MessageQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by contact ID' })
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Filter by platform' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ enum: DIRECTION_VALUES, description: 'Message direction' })
  @IsOptional()
  @IsIn(DIRECTION_VALUES)
  direction?: (typeof DIRECTION_VALUES)[number];

  @ApiPropertyOptional({ enum: MSG_TYPE_VALUES, description: 'Message type' })
  @IsOptional()
  @IsIn(MSG_TYPE_VALUES)
  msgType?: (typeof MSG_TYPE_VALUES)[number];

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Keyword search in content' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
