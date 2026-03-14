import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';

@Entity('platform_auths')
@Index('idx_platform_auths_user_id', ['userId'])
@Index('idx_platform_auths_user_platform', ['userId', 'platform'])
@Index('idx_platform_auths_status', ['status'])
export class PlatformAuth extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 30 })
  platform!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  accountNickname!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  accountAvatar!: string | null;

  @Column({ type: 'text' })
  accessToken!: string;

  @Column({ type: 'text', nullable: true })
  refreshToken!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'connected' })
  status!: string;

  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt!: Date | null;
}
