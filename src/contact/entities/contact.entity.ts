import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { StyleProfile } from '../../style/entities/style-profile.entity';

@Entity('contacts')
@Index('idx_contacts_user_id', ['userId'])
@Index('idx_contacts_user_platform', ['userId', 'platform'])
@Index('idx_contacts_platform_id', ['userId', 'platformId', 'platform'], {
  unique: true,
})
@Index('idx_contacts_level', ['userId', 'level'])
@Index('idx_contacts_whitelist', ['userId', 'isWhitelist'])
@Index('idx_contacts_blacklist', ['userId', 'isBlacklist'])
export class Contact extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 100 })
  platformId!: string;

  @Column({ type: 'varchar', length: 30 })
  platform!: string;

  @Column({ type: 'varchar', length: 100 })
  nickname!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  remark!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  level!: string;

  @Column({ type: 'boolean', default: false })
  isWhitelist!: boolean;

  @Column({ type: 'boolean', default: false })
  isBlacklist!: boolean;

  @Column({ type: 'jsonb', default: [] })
  tags!: string[];

  @Column({ type: 'uuid', nullable: true })
  customReplyProfileId!: string | null;

  @ManyToOne(() => StyleProfile, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'custom_reply_profile_id' })
  customReplyProfile!: StyleProfile | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'integer', default: 0 })
  messageCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt!: Date | null;
}
