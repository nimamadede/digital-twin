import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const RESPONSE_LENGTH_VALUES = ['short', 'medium', 'long'] as const;
const TONE_VALUES = ['casual', 'formal', 'friendly', 'professional'] as const;

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Profile name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Profile description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Partial traits to merge (formality, humor, etc.)',
    example: { formality: 0.8, humor: 0.2 },
  })
  @IsOptional()
  @IsObject()
  traits?: {
    formality?: number;
    humor?: number;
    verbosity?: number;
    emoji_frequency?: number;
    response_length?: 'short' | 'medium' | 'long';
    tone?: string;
    vocabulary_richness?: number;
    keywords?: string[];
    sentence_patterns?: string[];
    avg_message_length?: number;
    punctuation_style?: string;
  };
}

/** Validation for trait number fields (0-1). */
export function validateTraitNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}
