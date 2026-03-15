import { IsString, IsOptional, IsIn, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PLATFORM_VALUES = ['wechat', 'douyin'] as const;
const MSG_TYPE_VALUES = ['text', 'image', 'voice', 'file', 'system'] as const;

export class SimulateRouteDto {
  @ApiProperty({ description: 'Contact ID for context' })
  @IsString()
  contactId!: string;

  @ApiProperty({ example: '明天下午有时间吗？' })
  @IsString()
  incomingMessage!: string;

  @ApiProperty({ enum: PLATFORM_VALUES })
  @IsString()
  @IsIn(PLATFORM_VALUES)
  platform!: (typeof PLATFORM_VALUES)[number];

  @ApiPropertyOptional({ enum: MSG_TYPE_VALUES, default: 'text' })
  @IsOptional()
  @IsString()
  @IsIn(MSG_TYPE_VALUES)
  msgType?: (typeof MSG_TYPE_VALUES)[number];

  @ApiPropertyOptional({ example: '2026-03-14T14:30:00.000Z', description: 'Simulate at this time (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  simulateTime?: string;
}
