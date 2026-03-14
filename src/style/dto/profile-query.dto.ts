import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query DTO for listing style profiles. Uses pagination only; all queries are user_id scoped.
 */
export class ProfileQueryDto extends PaginationDto {}
