import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type {
  AuthorizeResult,
  AuthStatusResult,
  ListenerState,
} from './base.connector';
import { BaseConnector } from './base.connector';

export interface DouyinConfig {
  clientKey: string;
  clientSecret: string;
  callbackUrl: string;
}

const pendingAuths = new Map<
  string,
  {
    userId: string;
    status: AuthStatusResult['status'];
    createdAt: number;
  }
>();

const listenerStates = new Map<
  string,
  {
    isListening: boolean;
    startedAt: Date | null;
    messagesReceived: number;
    messagesProcessed: number;
    errors: number;
  }
>();

const AUTH_EXPIRES_MS = 300_000;
const MOCK_CONFIRM_AFTER_MS = 3000;

export class DouyinConnector extends BaseConnector {
  private readonly logger = new Logger(DouyinConnector.name);
  readonly platform = 'douyin';

  private config: DouyinConfig | null = null;

  setConfig(config: DouyinConfig): void {
    this.config = config;
  }

  getOAuthUrl(state: string): string {
    if (!this.config) return '';
    return `https://open.douyin.com/platform/oauth/connect/?client_key=${this.config.clientKey}&response_type=code&scope=user_info&redirect_uri=${encodeURIComponent(this.config.callbackUrl)}&state=${state}`;
  }

  async authorize(userId: string, authType: string): Promise<AuthorizeResult> {
    const authId = uuidv4();
    const qrcodeUrl = authType === 'qrcode' ? this.getOAuthUrl(authId) : undefined;

    pendingAuths.set(authId, {
      userId,
      status: 'waiting_scan',
      createdAt: Date.now(),
    });

    return {
      authId,
      qrcodeUrl,
      expiresIn: AUTH_EXPIRES_MS / 1000,
      status: 'waiting_scan',
    };
  }

  async getAuthStatus(userId: string, authId: string): Promise<AuthStatusResult> {
    const pending = pendingAuths.get(authId);
    if (!pending) return { authId, status: 'expired' };
    if (pending.userId !== userId) return { authId, status: 'failed' };

    const elapsed = Date.now() - pending.createdAt;
    if (elapsed > AUTH_EXPIRES_MS) {
      pendingAuths.delete(authId);
      return { authId, status: 'expired' };
    }

    if (pending.status === 'waiting_scan' && elapsed > 800) {
      pending.status = 'scanned';
    }
    if (pending.status === 'scanned' && elapsed > MOCK_CONFIRM_AFTER_MS) {
      pending.status = 'confirmed';
    }

    return { authId, status: pending.status };
  }

  async startListener(platformAuthId: string): Promise<void> {
    let state = listenerStates.get(platformAuthId);
    if (!state) {
      state = {
        isListening: false,
        startedAt: null,
        messagesReceived: 0,
        messagesProcessed: 0,
        errors: 0,
      };
      listenerStates.set(platformAuthId, state);
    }
    state.isListening = true;
    state.startedAt = state.startedAt ?? new Date();
    this.logger.log(`Douyin listener started for ${platformAuthId}`);
  }

  async stopListener(platformAuthId: string): Promise<void> {
    const state = listenerStates.get(platformAuthId);
    if (state) {
      state.isListening = false;
      this.logger.log(`Douyin listener stopped for ${platformAuthId}`);
    }
  }

  async getListenerState(platformAuthId: string): Promise<ListenerState> {
    const state = listenerStates.get(platformAuthId);
    if (!state) {
      return { isListening: false, startedAt: null, messagesReceived: 0, messagesProcessed: 0, errors: 0 };
    }
    return {
      isListening: state.isListening,
      startedAt: state.startedAt?.toISOString() ?? null,
      messagesReceived: state.messagesReceived,
      messagesProcessed: state.messagesProcessed,
      errors: state.errors,
    };
  }

  /**
   * Exchange authorization code for access token.
   * POST https://open.douyin.com/oauth/access_token/
   */
  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; openId: string } | null> {
    if (!this.config) return null;
    // TODO: Implement actual API call
    this.logger.warn('Douyin exchangeCodeForToken: using mock (configure real credentials)');
    return { accessToken: 'mock-douyin-token', openId: 'mock-open-id' };
  }

  /**
   * Send text on Douyin channel. Stub until Open API send is implemented.
   */
  async sendTextMessage(platformContactId: string, text: string): Promise<void> {
    this.logger.log(
      `Douyin sendTextMessage (stub): to=${platformContactId} len=${text.length}`,
    );
  }

  consumePendingAuth(authId: string): void {
    pendingAuths.delete(authId);
  }

  static clearMockState(): void {
    pendingAuths.clear();
    listenerStates.clear();
  }
}
