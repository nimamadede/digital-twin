import {
  IsOptional,
  IsBoolean,
  IsString,
  IsArray,
  IsNumber,
  Min,
  Max,
  Matches,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Schedule rule: time window and weekdays */
export class ScheduleRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: '09:00', description: 'HH:mm' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be HH:mm',
  })
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00', description: 'HH:mm' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be HH:mm',
  })
  endTime?: string;

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5], description: '1-7, Mon-Sun' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays?: number[];
}

/** Top-level rules object for scene mode */
export class SceneRulesDto {
  @ApiPropertyOptional({ type: ScheduleRuleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleRuleDto)
  schedule?: ScheduleRuleDto;

  @ApiPropertyOptional({ example: ['important', 'normal'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactLevels?: string[];

  @ApiPropertyOptional({ example: ['wechat'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;

  @ApiPropertyOptional({ description: 'Max delay in seconds before replying' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxReplyDelay?: number;

  @ApiPropertyOptional({ example: ['转账', '红包'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeKeywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customPrompt?: string;
}
