import {
  IsArray,
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  ArrayMinSize,
  IsUUID,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchUpdateFieldsDto {
  @ApiPropertyOptional({ enum: ['important', 'normal', 'low'] })
  @IsOptional()
  @IsString()
  @IsIn(['important', 'normal', 'low'])
  level?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isWhitelist?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBlacklist?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  remark?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class BatchUpdateContactsDto {
  @ApiProperty({ type: [String], example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  contactIds!: string[];

  @ApiProperty({ type: BatchUpdateFieldsDto, example: { level: 'normal', isWhitelist: false } })
  @ValidateNested()
  @Type(() => BatchUpdateFieldsDto)
  updates!: BatchUpdateFieldsDto;
}
