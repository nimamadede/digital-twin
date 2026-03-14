import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StyleProfile } from './style-profile.entity';

@Entity('style_samples')
@Index('idx_style_samples_profile_id', ['profileId'])
@Index('idx_style_samples_platform', ['platform'])
export class StyleSample {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  profileId!: string;

  @ManyToOne(() => StyleProfile, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: StyleProfile;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 30 })
  platform!: string;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
