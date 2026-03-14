import { v4 as uuidv4 } from 'uuid';
import type {
  AuthorizeResult,
  AuthStatusResult,
  ListenerState,
} from './base.connector';
import { BaseConnector } from './base.connector';

/**
 * In-memory store for pending auth sessions (dev mock only).
 * Key: authId. platformAuthId is created by PlatformService when status becomes confirmed.
 */
const pendingAuths = new Map<
  string,
  {
    userId: string;
    platform: string;
    status: AuthStatusResult['status'];
    createdAt: number;
  }
>();

/**
 * In-memory listener state per platformAuthId (dev mock).
 */
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

const MOCK_QRCODE_BASE = 'https://example.com/mock-wechat-qrcode';
const AUTH_EXPIRES_MS = 300_000; // 5 min
const MOCK_CONFIRM_AFTER_MS = 2000; // mock: confirm after 2s

export class WechatConnector extends BaseConnector {
  readonly platform = 'wechat';

  async authorize(userId: string, authType: string): Promise<AuthorizeResult> {
    const authId = uuidv4();
    const qrcodeUrl =
      authType === 'qrcode'
        ? `${MOCK_QRCODE_BASE}?authId=${authId}`
        : undefined;
    pendingAuths.set(authId, {
      userId,
      platform: this.platform,
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
    if (!pending) {
      return { authId, status: 'expired' };
    }
    if (pending.userId !== userId) {
      return { authId, status: 'failed' };
    }
    const elapsed = Date.now() - pending.createdAt;
    if (elapsed > AUTH_EXPIRES_MS) {
      pendingAuths.delete(authId);
      return { authId, status: 'expired' };
    }
    // Mock: progress status over time. platformAuthId is set by PlatformService when creating row.
    if (pending.status === 'waiting_scan' && elapsed > 500) {
      pending.status = 'scanned';
    }
    if (pending.status === 'scanned' && elapsed > MOCK_CONFIRM_AFTER_MS) {
      pending.status = 'confirmed';
    }
    return {
      authId,
      status: pending.status,
    };
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
  }

  async stopListener(platformAuthId: string): Promise<void> {
    const state = listenerStates.get(platformAuthId);
    if (state) {
      state.isListening = false;
    }
  }

  async getListenerState(platformAuthId: string): Promise<ListenerState> {
    const state = listenerStates.get(platformAuthId);
    if (!state) {
      return {
        isListening: false,
        startedAt: null,
        messagesReceived: 0,
        messagesProcessed: 0,
        errors: 0,
      };
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
   * Mock: clear pending auth after PlatformService has created PlatformAuth (avoid reuse).
   */
  consumePendingAuth(authId: string): void {
    pendingAuths.delete(authId);
  }

  /**
   * For tests: clear in-memory stores.
   */
  static clearMockState(): void {
    pendingAuths.clear();
    listenerStates.clear();
  }
}
