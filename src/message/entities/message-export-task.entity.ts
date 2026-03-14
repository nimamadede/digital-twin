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
import { FileUpload } from '../../storage/entities/file-upload.entity';

@Entity('message_export_tasks')
@Index('idx_message_export_tasks_user_id', ['userId'])
@Index('idx_message_export_tasks_status', ['userId', 'status'])
export class MessageExportTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ type: 'uuid', nullable: true })
  fileUploadId!: string | null;

  @ManyToOne(() => FileUpload, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'file_upload_id' })
  fileUpload!: FileUpload | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
