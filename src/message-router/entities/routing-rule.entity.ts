import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';

export interface RuleConditions {
  contact?: {
    level?: string;
    isWhitelist?: boolean;
    isBlacklist?: boolean;
    tags?: string[];
  };
  message?: {
    containsKeywords?: string[];
    msgType?: string;
    isGroup?: boolean;
    lengthMin?: number;
    lengthMax?: number;
  };
  platform?: {
    in?: string[];
  };
  time?: {
    startTime?: string;
    endTime?: string;
    weekdays?: number[];
  };
}

export interface RuleActionConfig {
  notifyUser?: boolean;
  autoApprove?: boolean;
  timeout?: number;
  timeoutAction?: string;
  maxDelay?: number;
  customPrompt?: string;
}

@Entity('routing_rules')
@Index('idx_routing_rules_user_id', ['userId'])
@Index('idx_routing_rules_user_priority', ['userId', 'priority'])
@Index('idx_routing_rules_user_enabled', ['userId', 'isEnabled'])
export class RoutingRule extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'integer', default: 50 })
  priority!: number;

  @Column({ type: 'boolean', default: true })
  isEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'route' })
  type!: string;

  @Column({ type: 'jsonb', default: {} })
  conditions!: RuleConditions;

  @Column({ type: 'varchar', length: 30 })
  action!: string;

  @Column({ type: 'jsonb', default: {} })
  actionConfig!: RuleActionConfig;

  @Column({ type: 'integer', default: 0 })
  triggerCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastTriggeredAt!: Date | null;
}
