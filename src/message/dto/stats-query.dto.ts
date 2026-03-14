import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const PERIOD_VALUES = ['day', 'week', 'month'] as const;

export class MessageStatsQueryDto {
  @ApiPropertyOptional({
    enum: PERIOD_VALUES,
    description: 'Stats period',
  })
  @IsOptional()
  @IsIn(PERIOD_VALUES)
  period?: (typeof PERIOD_VALUES)[number];

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
