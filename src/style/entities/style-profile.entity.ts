import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';

@Entity('style_profiles')
@Index('idx_style_profiles_user_id', ['userId'])
@Index('idx_style_profiles_status', ['status'])
@Index('idx_style_profiles_user_status', ['userId', 'status'])
export class StyleProfile extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: {} })
  traits!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vectorCollection!: string | null;

  @Column({ type: 'integer', default: 0 })
  sampleCount!: number;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: string;
}
