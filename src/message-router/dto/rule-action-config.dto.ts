import { IsOptional, IsBoolean, IsNumber, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RuleActionConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;

  @ApiPropertyOptional({ description: 'Timeout in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeout?: number;

  @ApiPropertyOptional({ example: 'auto_approve' })
  @IsOptional()
  @IsString()
  timeoutAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDelay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customPrompt?: string;
}
