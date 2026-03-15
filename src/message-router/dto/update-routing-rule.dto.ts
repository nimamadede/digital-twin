import {
  IsString,
  IsBoolean,
  IsIn,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RuleConditionsDto } from './rule-conditions.dto';
import { RuleActionConfigDto } from './rule-action-config.dto';

const RULE_TYPES = ['block', 'route', 'transform'] as const;
const RULE_ACTIONS = [
  'auto_reply',
  'pending_review',
  'blocked',
  'ignored',
  'manual',
] as const;

export class UpdateRoutingRuleDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ enum: RULE_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(RULE_TYPES)
  type?: (typeof RULE_TYPES)[number];

  @ApiPropertyOptional({ type: RuleConditionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleConditionsDto)
  conditions?: RuleConditionsDto;

  @ApiPropertyOptional({ enum: RULE_ACTIONS })
  @IsOptional()
  @IsString()
  @IsIn(RULE_ACTIONS)
  action?: (typeof RULE_ACTIONS)[number];

  @ApiPropertyOptional({ type: RuleActionConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleActionConfigDto)
  actionConfig?: RuleActionConfigDto;
}
