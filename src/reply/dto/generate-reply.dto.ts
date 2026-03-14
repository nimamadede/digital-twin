import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContextItemDto } from './context-item.dto';

export class GenerateReplyDto {
  @ApiProperty({ description: 'Incoming message content' })
  @IsString()
  incomingMessage!: string;

  @ApiPropertyOptional({ description: 'Contact ID for personalization' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Style profile ID (default if not provided)' })
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @ApiPropertyOptional({ description: 'Scene mode ID (current active if not provided)' })
  @IsOptional()
  @IsUUID()
  sceneId?: string;

  @ApiPropertyOptional({
    type: [ContextItemDto],
    description: 'Recent conversation context',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContextItemDto)
  context?: ContextItemDto[];

  @ApiPropertyOptional({ description: 'Number of candidate replies (1-5)', default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  count?: number = 3;
}
