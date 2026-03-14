import {
  Entity,
  Column,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('users')
@Index('idx_users_phone', ['phone'], { unique: true })
@Index('idx_users_status', ['status'])
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 20, unique: true })
  phone!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 50 })
  nickname!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;
}
