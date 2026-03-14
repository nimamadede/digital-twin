import {
  IsString,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsIn,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SceneRulesDto } from './rules.dto';

const REPLY_STYLES = ['formal', 'casual', 'brief', 'humorous', 'custom'] as const;

export class CreateSceneDto {
  @ApiProperty({ example: '会议模式', minLength: 2, maxLength: 30 })
  @IsString()
  @MinLength(2, { message: 'name must be 2-30 characters' })
  @MaxLength(30)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: REPLY_STYLES })
  @IsString()
  @IsIn(REPLY_STYLES)
  replyStyle!: string;

  @ApiProperty()
  @IsBoolean()
  autoReply!: boolean;

  @ApiProperty({ type: SceneRulesDto, description: 'Scene rules config' })
  @ValidateNested()
  @Type(() => SceneRulesDto)
  rules!: SceneRulesDto;

  @ApiPropertyOptional({ description: 'Style profile UUID' })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}
