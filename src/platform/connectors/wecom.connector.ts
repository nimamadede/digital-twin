import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type {
  AuthorizeResult,
  AuthStatusResult,
  ListenerState,
} from './base.connector';
import { BaseConnector } from './base.connector';

export interface WeComConfig {
  corpId: string;
  agentId: string;
  secret: string;
  token: string;
  encodingAESKey: string;
  callbackUrl: string;
}

const pendingAuths = new Map<
  string,
  {
    userId: string;
    status: AuthStatusResult['status'];
    createdAt: number;
    oauthUrl?: string;
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
const MOCK_CONFIRM_AFTER_MS = 2000;

export class WeComConnector extends BaseConnector {
  private readonly logger = new Logger(WeComConnector.name);
  readonly platform = 'wecom';

  private config: WeComConfig | null = null;

  setConfig(config: WeComConfig): void {
    this.config = config;
  }

  getOAuthUrl(state: string): string {
    if (!this.config) return '';
    return `https://open.work.weixin.qq.com/wwopen/sso/qrConnect?appid=${this.config.corpId}&agentid=${this.config.agentId}&redirect_uri=${encodeURIComponent(this.config.callbackUrl)}&state=${state}`;
  }

  async authorize(userId: string, authType: string): Promise<AuthorizeResult> {
    const authId = uuidv4();
    const oauthUrl = authType === 'qrcode' ? this.getOAuthUrl(authId) : undefined;

    pendingAuths.set(authId, {
      userId,
      status: 'waiting_scan',
      createdAt: Date.now(),
      oauthUrl,
    });

    return {
      authId,
      qrcodeUrl: oauthUrl,
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

    // Mock progression for dev
    if (pending.status === 'waiting_scan' && elapsed > 500) {
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
    this.logger.log(`WeCom listener started for ${platformAuthId}`);
  }

  async stopListener(platformAuthId: string): Promise<void> {
    const state = listenerStates.get(platformAuthId);
    if (state) {
      state.isListening = false;
      this.logger.log(`WeCom listener stopped for ${platformAuthId}`);
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
   * Handle WeCom callback URL verification (GET request).
   * WeCom sends msg_signature, timestamp, nonce, echostr for verification.
   */
  verifyCallback(msgSignature: string, timestamp: string, nonce: string, echostr: string): string {
    // TODO: Implement actual signature verification with token + encodingAESKey
    // For now return echostr for dev/testing
    this.logger.log(`WeCom callback verification: nonce=${nonce}`);
    return echostr;
  }

  /**
   * Handle incoming WeCom message callback (POST request).
   * Decrypts and parses the XML message body.
   */
  async handleMessageCallback(
    msgSignature: string,
    timestamp: string,
    nonce: string,
    encryptedBody: string,
  ): Promise<{ msgType: string; content: string; fromUser: string; toUser: string } | null> {
    // TODO: Implement actual XML decryption with AES
    // Stub: parse basic fields for dev
    this.logger.log(`WeCom message callback received, nonce=${nonce}`);
    return null;
  }

  /**
   * Get WeCom access token using corpId + secret.
   * In production, cache this token (expires in 7200s).
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.config) return null;
    // TODO: Call https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=ID&corpsecret=SECRET
    // For now return mock token
    this.logger.warn('WeCom getAccessToken: using mock token (configure real credentials)');
    return 'mock-wecom-access-token';
  }

  /**
   * Sync contacts from WeCom department API.
   * GET https://qyapi.weixin.qq.com/cgi-bin/user/simplelist?access_token=TOKEN&department_id=1
   */
  async syncDepartmentContacts(departmentId = 1): Promise<Array<{ userid: string; name: string; department: number[] }>> {
    const token = await this.getAccessToken();
    if (!token) return [];
    // TODO: Implement actual API call
    this.logger.warn('WeCom syncDepartmentContacts: stub (configure real credentials)');
    return [];
  }

  /**
   * Send text to a WeCom user. Stub until qyapi message API is implemented.
   */
  async sendTextMessage(platformContactId: string, text: string): Promise<void> {
    this.logger.log(
      `WeCom sendTextMessage (stub): to=${platformContactId} len=${text.length}`,
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
