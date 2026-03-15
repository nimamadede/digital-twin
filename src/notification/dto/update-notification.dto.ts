import { IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationDto {
  @ApiPropertyOptional({ description: 'Mark as read' })
  @IsBoolean()
  isRead!: boolean;
}
