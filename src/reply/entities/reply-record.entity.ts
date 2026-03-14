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
import { Contact } from '../../contact/entities/contact.entity';
import { StyleProfile } from '../../style/entities/style-profile.entity';
import { SceneMode } from '../../scene/entities/scene-mode.entity';

@Entity('reply_records')
@Index('idx_reply_records_user_id', ['userId'])
@Index('idx_reply_records_status', ['userId', 'status'])
@Index('idx_reply_records_contact', ['userId', 'contactId'])
@Index('idx_reply_records_created', ['userId', 'createdAt'])
@Index('idx_reply_records_expires', ['status', 'expiresAt'])
export class ReplyRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid' })
  contactId!: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact!: Contact;

  @Column({ type: 'uuid', nullable: true })
  profileId!: string | null;

  @ManyToOne(() => StyleProfile, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: StyleProfile | null;

  @Column({ type: 'uuid', nullable: true })
  sceneId!: string | null;

  @ManyToOne(() => SceneMode, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene!: SceneMode | null;

  @Column({ type: 'uuid', nullable: true })
  incomingMessageId!: string | null;

  @ManyToOne('Message', { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'incoming_message_id' })
  incomingMessage!: unknown;

  @Column({ type: 'text' })
  incomingContent!: string;

  @Column({ type: 'jsonb', default: [] })
  candidates!: unknown[];

  @Column({ type: 'integer', nullable: true })
  selectedIndex!: number | null;

  @Column({ type: 'text', nullable: true })
  sentContent!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ type: 'integer', nullable: true })
  feedbackRating!: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  feedbackTag!: string | null;

  @Column({ type: 'text', nullable: true })
  feedbackComment!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
