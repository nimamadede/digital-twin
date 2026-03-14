import { IsIn, IsString, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Single context message item for reply generation.
 */
export class ContextItemDto {
  @ApiPropertyOptional({ enum: ['contact', 'user'] })
  @IsIn(['contact', 'user'])
  role!: 'contact' | 'user';

  @ApiPropertyOptional()
  @IsString()
  content!: string;

  @ApiPropertyOptional({ example: '2026-03-14T09:00:00.000Z' })
  @IsISO8601()
  timestamp!: string;
}
