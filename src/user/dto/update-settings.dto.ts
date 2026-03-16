import {
  IsOptional,
  IsBoolean,
  IsNumber,
  IsString,
  IsIn,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const LANGUAGE_ENUM = ['zh-CN', 'en-US'] as const;

export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Default scene mode UUID' })
  @IsOptional()
  @IsUUID()
  defaultSceneId?: string;

  @ApiPropertyOptional({ description: 'Auto reply enabled' })
  @IsOptional()
  @IsBoolean()
  autoReply?: boolean;

  @ApiPropertyOptional({ description: 'Notification enabled' })
  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Review timeout in seconds', minimum: 30, maximum: 3600 })
  @IsOptional()
  @IsNumber()
  @Min(30, { message: 'reviewTimeout must be between 30 and 3600' })
  @Max(3600, { message: 'reviewTimeout must be between 30 and 3600' })
  reviewTimeout?: number;

  @ApiPropertyOptional({ enum: LANGUAGE_ENUM })
  @IsOptional()
  @IsString()
  @IsIn(LANGUAGE_ENUM, { message: 'language must be zh-CN or en-US' })
  language?: string;
}
