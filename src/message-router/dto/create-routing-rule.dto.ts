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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateRoutingRuleDto {
  @ApiProperty({ example: '工作群消息忽略', minLength: 2, maxLength: 50 })
  @IsString()
  @MinLength(2, { message: 'name must be 2-50 characters' })
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 100, description: 'Lower number = higher priority' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  priority!: number;

  @ApiProperty()
  @IsBoolean()
  isEnabled!: boolean;

  @ApiProperty({ enum: RULE_TYPES })
  @IsString()
  @IsIn(RULE_TYPES)
  type!: (typeof RULE_TYPES)[number];

  @ApiProperty({ type: RuleConditionsDto, description: 'Match conditions' })
  @ValidateNested()
  @Type(() => RuleConditionsDto)
  conditions!: RuleConditionsDto;

  @ApiProperty({ enum: RULE_ACTIONS })
  @IsString()
  @IsIn(RULE_ACTIONS)
  action!: (typeof RULE_ACTIONS)[number];

  @ApiPropertyOptional({ type: RuleActionConfigDto, default: {} })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleActionConfigDto)
  actionConfig?: RuleActionConfigDto;
}
