import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ContactQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  @IsIn(['important', 'normal', 'low'])
  level?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isWhitelist?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBlacklist?: boolean;

  @IsOptional()
  @IsString()
  keyword?: string;
}
