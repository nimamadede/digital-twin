import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewReplyDto {
  @ApiProperty({
    enum: ['approve', 'reject', 'edit'],
    description: 'Review action',
  })
  @IsIn(['approve', 'reject', 'edit'])
  action!: 'approve' | 'reject' | 'edit';

  @ApiPropertyOptional({
    description: 'Selected candidate index (required when action=approve)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectedIndex?: number;

  @ApiPropertyOptional({
    description: 'Edited content (required when action=edit)',
  })
  @IsOptional()
  @IsString()
  editedContent?: string;
}
