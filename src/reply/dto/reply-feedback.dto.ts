import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const FEEDBACK_TAGS = [
  'tone_mismatch',
  'too_long',
  'too_short',
  'inappropriate',
  'perfect',
] as const;

export class ReplyFeedbackDto {
  @ApiProperty({ description: 'Rating 1-5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    enum: FEEDBACK_TAGS,
    description: 'Feedback tag',
  })
  @IsOptional()
  @IsIn(FEEDBACK_TAGS)
  feedback?: (typeof FEEDBACK_TAGS)[number];

  @ApiPropertyOptional({ description: 'Free-text comment', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
