import { IsBoolean, IsOptional, IsArray, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const MESSAGE_TYPES = ['text', 'image', 'voice', 'video', 'file', 'system'] as const;

export class UpdatePlatformDto {
  @ApiPropertyOptional({ description: 'Auto start message listener' })
  @IsOptional()
  @IsBoolean()
  autoListen?: boolean;

  @ApiPropertyOptional({ description: 'Listen to group messages' })
  @IsOptional()
  @IsBoolean()
  listenGroups?: boolean;

  @ApiPropertyOptional({ enum: MESSAGE_TYPES, isArray: true, description: 'Message types to listen' })
  @IsOptional()
  @IsArray()
  @IsIn(MESSAGE_TYPES, { each: true })
  messageTypes?: (typeof MESSAGE_TYPES)[number][];
}
