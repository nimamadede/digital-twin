import {
  IsString,
  IsIn,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportContactsDto {
  @ApiProperty({
    enum: ['wechat', 'wecom', 'telegram', 'whatsapp'],
    description: 'Platform name for imported contacts',
  })
  @IsString()
  @IsIn(['wechat', 'wecom', 'telegram', 'whatsapp'])
  platform!: string;

  @ApiPropertyOptional({ description: 'Default level for imported contacts' })
  @IsOptional()
  @IsString()
  @IsIn(['important', 'normal', 'low'])
  defaultLevel?: string;

  @ApiPropertyOptional({ description: 'Description or remark for this import' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
