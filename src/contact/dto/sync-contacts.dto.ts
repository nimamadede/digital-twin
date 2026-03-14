import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SyncContactsDto {
  @ApiProperty({ description: 'Platform auth record UUID' })
  @IsUUID()
  platformAuthId!: string;
}
