import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const FORMAT_VALUES = ['csv', 'json'] as const;

export class ExportMessagesDto {
  @ApiPropertyOptional({ description: 'Contact ID (omit to export all)' })
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ enum: FORMAT_VALUES, description: 'Export format' })
  @IsIn(FORMAT_VALUES)
  format!: (typeof FORMAT_VALUES)[number];
}
