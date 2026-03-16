import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PlatformAuth } from './entities/platform-auth.entity';
import { WechatConnector } from './connectors/wechat.connector';
import { DouyinConnector } from './connectors/douyin.connector';
import type { AuthorizeResult, AuthStatusResult } from './connectors/base.connector';
import {
  PLATFORM_CONNECTOR_REGISTRY,
  type ConnectorRegistry,
} from './services/message-listener.service';
import type { UpdatePlatformDto } from './dto/update-platform.dto';

const MOCK_ACCESS_TOKEN_PREFIX = 'mock_access_';

export interface PlatformListItem {
  id: string;
  platform: string;
  displayName: string;
  status: string;
  accountInfo: {
    nickname: string;
    avatar: string | null;
  };
  connectedAt: string;
  lastActiveAt: string | null;
}

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  wechat: '微信',
  douyin: '抖音',
};

/** In-memory: authId -> { userId, platform } for polling auth status (dev mock). */
const pendingAuth = new Map<string, { userId: string; platform: string }>();

@Injectable()
export class PlatformService {
  constructor(
    @InjectRepository(PlatformAuth)
    private readonly platformAuthRepo: Repository<PlatformAuth>,
    @Inject(PLATFORM_CONNECTOR_REGISTRY)
    private readonly connectors: ConnectorRegistry,
  ) {}

  /**
   * List connected platforms for user. All queries scoped by userId.
   */
  async list(userId: string): Promise<PlatformListItem[]> {
    const list = await this.platformAuthRepo.find({
      where: { userId, status: 'connected' },
      order: { createdAt: 'DESC' },
    });
    return list.map((row) => ({
      id: row.id,
      platform: row.platform,
      displayName: PLATFORM_DISPLAY_NAMES[row.platform] ?? row.platform,
      status: row.status,
      accountInfo: {
        nickname: row.accountNickname ?? '',
        avatar: row.accountAvatar ?? null,
      },
      connectedAt: row.createdAt.toISOString(),
      lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    }));
  }

  /**
   * Start platform authorization (e.g. WeChat QR code). Mock returns authId and qrcode URL.
   */
  async authorize(
    userId: string,
    platform: string,
    authType: string,
  ): Promise<AuthorizeResult> {
    const connector = this.connectors.get(platform);
    if (!connector) {
      return {
        authId: '',
        expiresIn: 0,
        status: 'failed',
      };
    }
    const result = await connector.authorize(userId, authType);
    if (result.authId) {
      pendingAuth.set(result.authId, { userId, platform });
    }
    return result;
  }

  /**
   * Poll authorization status. When confirmed, creates PlatformAuth and returns platformAuthId.
   */
  async getAuthStatus(
    userId: string,
    authId: string,
  ): Promise<AuthStatusResult> {
    const pending = pendingAuth.get(authId);
    if (!pending) {
      return { authId, status: 'expired' };
    }
    if (pending.userId !== userId) {
      return { authId, status: 'expired' };
    }
    const connector = this.connectors.get(pending.platform);
    if (!connector) {
      return { authId, status: 'expired' };
    }
    const result = await connector.getAuthStatus(userId, authId);
    if (result.status === 'confirmed' && pending.platform === 'wechat') {
      const auth = this.platformAuthRepo.create({
        userId,
        platform: 'wechat',
        accountNickname: '小明的微信',
        accountAvatar: 'https://example.com/mock-avatar.png',
        accessToken: MOCK_ACCESS_TOKEN_PREFIX + uuidv4(),
        refreshToken: null,
        tokenExpiresAt: null,
        status: 'connected',
        config: {},
        lastActiveAt: new Date(),
      });
      const saved = await this.platformAuthRepo.save(auth);
      (connector as WechatConnector).consumePendingAuth(authId);
      pendingAuth.delete(authId);
      return {
        authId,
        status: 'confirmed',
        platformAuthId: saved.id,
      };
    }
    if (result.status === 'expired' || result.status === 'failed') {
      pendingAuth.delete(authId);
    }
    return result;
  }

  /**
   * Disconnect platform. Enforces userId isolation.
   */
  async disconnect(userId: string, platformAuthId: string): Promise<void> {
    const auth = await this.platformAuthRepo.findOne({
      where: { id: platformAuthId, userId },
    });
    if (!auth) {
      throw new NotFoundException('Platform auth not found');
    }
    await this.platformAuthRepo.remove(auth);
  }

  /**
   * Update platform config (autoListen, listenGroups, messageTypes). Enforces userId isolation.
   */
  async updateConfig(
    userId: string,
    platformAuthId: string,
    dto: UpdatePlatformDto,
  ): Promise<void> {
    const auth = await this.platformAuthRepo.findOne({
      where: { id: platformAuthId, userId },
    });
    if (!auth) {
      throw new NotFoundException('Platform auth not found');
    }
    const config = { ...(auth.config as Record<string, unknown>) };
    if (dto.autoListen !== undefined) config.autoListen = dto.autoListen;
    if (dto.listenGroups !== undefined) config.listenGroups = dto.listenGroups;
    if (dto.messageTypes !== undefined) config.messageTypes = dto.messageTypes;
    auth.config = config;
    await this.platformAuthRepo.save(auth);
  }
}
