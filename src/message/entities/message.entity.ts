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

@Entity('messages')
@Index('idx_messages_user_id', ['userId'])
@Index('idx_messages_contact_id', ['userId', 'contactId'])
@Index('idx_messages_user_created', ['userId', 'createdAt'])
@Index('idx_messages_platform', ['userId', 'platform'])
@Index('idx_messages_direction', ['userId', 'direction'])
@Index('idx_messages_contact_created', ['userId', 'contactId', 'createdAt'])
@Index('idx_messages_platform_msg_id', ['platformMsgId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  contactId!: string | null;

  @ManyToOne(() => Contact, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact!: Contact | null;

  @Column({ type: 'varchar', length: 10 })
  direction!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 20, default: 'text' })
  msgType!: string;

  @Column({ type: 'varchar', length: 30 })
  platform!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  platformMsgId!: string | null;

  @Column({ type: 'boolean', default: false })
  isAiGenerated!: boolean;

  @Column({ type: 'uuid', nullable: true })
  replyRecordId!: string | null;

  @ManyToOne('ReplyRecord', { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'reply_record_id' })
  replyRecord!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
