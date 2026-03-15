import { IsOptional, IsIn, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const PERIOD_VALUES = ['day', 'week', 'month'] as const;

export class RouterStatsQueryDto {
  @ApiPropertyOptional({ enum: PERIOD_VALUES })
  @IsOptional()
  @IsIn(PERIOD_VALUES)
  period?: (typeof PERIOD_VALUES)[number];

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
