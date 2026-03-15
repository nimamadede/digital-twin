import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderRulesDto {
  @ApiProperty({
    type: [String],
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
    description: 'Rule IDs in desired priority order (first = priority 1)',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  orderedIds!: string[];
}
