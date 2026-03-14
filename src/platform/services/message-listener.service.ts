import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformAuth } from '../entities/platform-auth.entity';
import type { BaseConnector } from '../connectors/base.connector';
import type { ListenerState } from '../connectors/base.connector';

export const PLATFORM_CONNECTOR_REGISTRY = 'PLATFORM_CONNECTOR_REGISTRY';

export type ConnectorRegistry = Map<string, BaseConnector>;

@Injectable()
export class MessageListenerService {
  constructor(
    @InjectRepository(PlatformAuth)
    private readonly platformAuthRepo: Repository<PlatformAuth>,
    @Inject(PLATFORM_CONNECTOR_REGISTRY)
    private readonly connectors: ConnectorRegistry,
  ) {}

  /**
   * Start message listener for platform auth. Enforces userId isolation.
   */
  async start(userId: string, platformAuthId: string): Promise<void> {
    const auth = await this.platformAuthRepo.findOne({
      where: { id: platformAuthId, userId },
    });
    if (!auth) {
      throw new NotFoundException('Platform auth not found');
    }
    const connector = this.connectors.get(auth.platform);
    if (connector) {
      await connector.startListener(platformAuthId);
    }
  }

  /**
   * Stop message listener. Enforces userId isolation.
   */
  async stop(userId: string, platformAuthId: string): Promise<void> {
    const auth = await this.platformAuthRepo.findOne({
      where: { id: platformAuthId, userId },
    });
    if (!auth) {
      throw new NotFoundException('Platform auth not found');
    }
    const connector = this.connectors.get(auth.platform);
    if (connector) {
      await connector.stopListener(platformAuthId);
    }
  }

  /**
   * Get listener state for platform auth. Enforces userId isolation.
   */
  async getState(userId: string, platformAuthId: string): Promise<ListenerState> {
    const auth = await this.platformAuthRepo.findOne({
      where: { id: platformAuthId, userId },
    });
    if (!auth) {
      throw new NotFoundException('Platform auth not found');
    }
    const connector = this.connectors.get(auth.platform);
    if (!connector) {
      return {
        isListening: false,
        startedAt: null,
        messagesReceived: 0,
        messagesProcessed: 0,
        errors: 0,
      };
    }
    return connector.getListenerState(platformAuthId);
  }
}
