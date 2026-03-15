import { IsString, IsOptional, IsIn, MaxLength, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const NOTIFICATION_TYPES = ['info', 'warning', 'error', 'success'] as const;

export class CreateNotificationDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES, description: 'Notification type' })
  @IsIn(NOTIFICATION_TYPES)
  type!: (typeof NOTIFICATION_TYPES)[number];

  @ApiProperty({ maxLength: 200, description: 'Title' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Content' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ maxLength: 500, description: 'Action URL (absolute or relative)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Extra metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
