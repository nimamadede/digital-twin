import { IsString, IsIn, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PLATFORM_VALUES = ['wechat', 'douyin', 'other'] as const;

export class UploadChatDto {
  @ApiProperty({
    enum: PLATFORM_VALUES,
    description: 'Source platform of chat data',
  })
  @IsString()
  @IsIn(PLATFORM_VALUES)
  platform!: (typeof PLATFORM_VALUES)[number];

  @ApiPropertyOptional({ description: 'Optional file description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
