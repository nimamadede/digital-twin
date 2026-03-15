import { IsString, IsOptional, IsBoolean, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PLATFORM_VALUES = ['wechat', 'douyin'] as const;
const MSG_TYPE_VALUES = ['text', 'image', 'voice', 'file', 'system'] as const;

export class InboundMessageDto {
  @ApiProperty({ description: 'Platform identifier' })
  @IsString()
  @IsIn(PLATFORM_VALUES)
  platform!: (typeof PLATFORM_VALUES)[number];

  @ApiProperty({ description: 'Contact ID on platform (e.g. WeChat openId)' })
  @IsString()
  @MaxLength(100)
  platformContactId!: string;

  @ApiPropertyOptional({ description: 'Display name when creating new contact' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ enum: MSG_TYPE_VALUES, default: 'text' })
  @IsOptional()
  @IsString()
  @IsIn(MSG_TYPE_VALUES)
  msgType?: (typeof MSG_TYPE_VALUES)[number];

  @ApiPropertyOptional({ description: 'Whether message is from a group' })
  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;
}
