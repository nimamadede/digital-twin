import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Nickname', minLength: 2, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'nickname must be 2-50 characters' })
  @MaxLength(50, { message: 'nickname must be 2-50 characters' })
  nickname?: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ description: 'Bio', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'bio must be 0-500 characters' })
  bio?: string;
}
