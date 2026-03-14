import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

const PURPOSE_VALUES = ['style_analysis', 'export'] as const;
const STATUS_VALUES = ['uploaded', 'processing', 'completed', 'deleted'] as const;

export class FileQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PURPOSE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(PURPOSE_VALUES)
  purpose?: (typeof PURPOSE_VALUES)[number];

  @ApiPropertyOptional({ enum: STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(STATUS_VALUES)
  status?: (typeof STATUS_VALUES)[number];
}
