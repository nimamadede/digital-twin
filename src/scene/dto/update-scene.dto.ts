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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SceneRulesDto } from './rules.dto';

const REPLY_STYLES = ['formal', 'casual', 'brief', 'humorous', 'custom'] as const;

export class UpdateSceneDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: REPLY_STYLES })
  @IsOptional()
  @IsString()
  @IsIn(REPLY_STYLES)
  replyStyle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoReply?: boolean;

  @ApiPropertyOptional({ type: SceneRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SceneRulesDto)
  rules?: SceneRulesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  profileId?: string;
}
