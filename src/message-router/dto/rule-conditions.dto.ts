import {
  IsOptional,
  IsBoolean,
  IsString,
  IsArray,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RuleContactConditionsDto {
  @ApiPropertyOptional({ example: 'important' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isWhitelist?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBlacklist?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['客户'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class RuleMessageConditionsDto {
  @ApiPropertyOptional({ type: [String], example: ['转账', '红包'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  containsKeywords?: string[];

  @ApiPropertyOptional({ example: 'text' })
  @IsOptional()
  @IsString()
  msgType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lengthMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  lengthMax?: number;
}

export class RulePlatformConditionsDto {
  @ApiPropertyOptional({ type: [String], example: ['wechat', 'douyin'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  in?: string[];
}

export class RuleTimeConditionsDto {
  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ type: [Number], example: [1, 2, 3, 4, 5], description: '1-7 weekdays' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays?: number[];
}

export class RuleConditionsDto {
  @ApiPropertyOptional({ type: RuleContactConditionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleContactConditionsDto)
  contact?: RuleContactConditionsDto;

  @ApiPropertyOptional({ type: RuleMessageConditionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleMessageConditionsDto)
  message?: RuleMessageConditionsDto;

  @ApiPropertyOptional({ type: RulePlatformConditionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RulePlatformConditionsDto)
  platform?: RulePlatformConditionsDto;

  @ApiPropertyOptional({ type: RuleTimeConditionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleTimeConditionsDto)
  time?: RuleTimeConditionsDto;
}
