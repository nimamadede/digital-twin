import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from './user.entity';

@Entity('user_settings')
@Index('idx_user_settings_user_id', ['userId'], { unique: true })
export class UserSettings extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  defaultSceneId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  defaultProfileId!: string | null;

  @Column({ type: 'boolean', default: true })
  autoReply!: boolean;

  @Column({ type: 'boolean', default: true })
  notificationEnabled!: boolean;

  @Column({ type: 'integer', default: 300 })
  reviewTimeout!: number;

  @Column({ type: 'varchar', length: 10, default: 'zh-CN' })
  language!: string;
}
