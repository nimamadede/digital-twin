import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { StyleProfile } from '../../style/entities/style-profile.entity';

@Entity('scene_modes')
@Index('idx_scene_modes_user_id', ['userId'])
@Index('idx_scene_modes_user_active', ['userId', 'isActive'])
export class SceneMode extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'casual' })
  replyStyle!: string;

  @Column({ type: 'boolean', default: true })
  autoReply!: boolean;

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ type: 'jsonb', default: {} })
  rules!: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  profileId!: string | null;

  @ManyToOne(() => StyleProfile, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: StyleProfile | null;

  @Column({ type: 'integer', default: 0 })
  sortOrder!: number;
}
