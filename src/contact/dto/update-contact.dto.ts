import {
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  IsUUID,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateContactDto {
  @ApiPropertyOptional({ enum: ['important', 'normal', 'low'] })
  @IsOptional()
  @IsString()
  @IsIn(['important', 'normal', 'low'])
  level?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isWhitelist?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBlacklist?: boolean;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  remark?: string;

  @ApiPropertyOptional({ example: ['客户', 'VIP'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Style profile UUID for custom reply' })
  @IsOptional()
  @IsUUID()
  customReplyProfile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
