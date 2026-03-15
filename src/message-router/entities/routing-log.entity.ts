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
import { Message } from '../../message/entities/message.entity';
import { Contact } from '../../contact/entities/contact.entity';
import { RoutingRule } from './routing-rule.entity';
import { SceneMode } from '../../scene/entities/scene-mode.entity';
import { StyleProfile } from '../../style/entities/style-profile.entity';
import { ReplyRecord } from '../../reply/entities/reply-record.entity';

export interface RoutingStepDetail {
  step: string;
  result: string;
  duration?: number;
  detail?: Record<string, unknown> | null;
}

@Entity('routing_logs')
@Index('idx_routing_logs_user_id', ['userId'])
@Index('idx_routing_logs_user_created', ['userId', 'createdAt'])
@Index('idx_routing_logs_action', ['userId', 'action'])
@Index('idx_routing_logs_contact', ['userId', 'contactId'])
@Index('idx_routing_logs_scene', ['userId', 'sceneId'])
@Index('idx_routing_logs_rule', ['userId', 'matchedRuleId'])
@Index('idx_routing_logs_message', ['messageId'], { unique: true })
export class RoutingLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid' })
  messageId!: string;

  @ManyToOne(() => Message, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message!: Message;

  @Column({ type: 'uuid' })
  contactId!: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact!: Contact;

  @Column({ type: 'varchar', length: 30 })
  platform!: string;

  @Column({ type: 'text' })
  incomingContent!: string;

  @Column({ type: 'uuid', nullable: true })
  matchedRuleId!: string | null;

  @ManyToOne(() => RoutingRule, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'matched_rule_id' })
  matchedRule!: RoutingRule | null;

  @Column({ type: 'uuid', nullable: true })
  sceneId!: string | null;

  @ManyToOne(() => SceneMode, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene!: SceneMode | null;

  @Column({ type: 'uuid', nullable: true })
  profileId!: string | null;

  @ManyToOne(() => StyleProfile, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: StyleProfile | null;

  @Column({ type: 'uuid', nullable: true })
  replyRecordId!: string | null;

  @ManyToOne(() => ReplyRecord, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'reply_record_id' })
  replyRecord!: ReplyRecord | null;

  @Column({ type: 'varchar', length: 30 })
  action!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  replySentContent!: string | null;

  @Column({ type: 'jsonb', default: [] })
  steps!: RoutingStepDetail[];

  @Column({ type: 'integer', default: 0 })
  processingTime!: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
