import { IsString, IsIn, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PURPOSE_VALUES = ['style_analysis', 'export'] as const;

export class UploadFileDto {
  @ApiProperty({ enum: PURPOSE_VALUES, description: 'File purpose' })
  @IsString()
  @IsIn(PURPOSE_VALUES)
  purpose!: 'style_analysis' | 'export';

  @ApiPropertyOptional({
    description: 'Expiry seconds for temporary file (optional)',
    minimum: 60,
    maximum: 604800,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(604800)
  expiresIn?: number;
}
