import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query for conversation list (GET /messages/conversations).
 */
export class ConversationListQueryDto extends PaginationDto {}

/**
 * Query for conversation detail with a contact (GET /messages/conversations/:contactId).
 */
export class ConversationDetailQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Load messages before this time (ISO 8601) for infinite scroll',
  })
  @IsOptional()
  @IsString()
  before?: string;
}
