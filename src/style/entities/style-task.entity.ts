import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { StyleProfile } from './style-profile.entity';
import { FileUpload } from '../../storage/entities/file-upload.entity';

@Entity('style_tasks')
@Index('idx_style_tasks_user_id', ['userId'])
@Index('idx_style_tasks_status', ['status'])
export class StyleTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  profileId!: string | null;

  @ManyToOne(() => StyleProfile, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: StyleProfile | null;

  @Column({ type: 'uuid', nullable: true })
  fileId!: string | null;

  @ManyToOne(() => FileUpload, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file!: FileUpload | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ type: 'integer', default: 0 })
  progress!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
