/**
 * Base connector for platform message bridge.
 * Implementations: WeChat, Douyin, etc.
 */
export interface AuthorizeResult {
  authId: string;
  qrcodeUrl?: string;
  expiresIn: number;
  status: 'waiting_scan' | 'scanned' | 'confirmed' | 'expired' | 'failed';
}

export interface AuthStatusResult {
  authId: string;
  status: 'waiting_scan' | 'scanned' | 'confirmed' | 'expired' | 'failed';
  platformAuthId?: string;
}

export interface ListenerState {
  isListening: boolean;
  startedAt: string | null;
  messagesReceived: number;
  messagesProcessed: number;
  errors: number;
}

export abstract class BaseConnector {
  abstract readonly platform: string;

  /**
   * Start authorization flow (e.g. return qrcode URL for scan).
   */
  abstract authorize(userId: string, authType: string): Promise<AuthorizeResult>;

  /**
   * Poll authorization status. When confirmed, returns platformAuthId.
   */
  abstract getAuthStatus(userId: string, authId: string): Promise<AuthStatusResult>;

  /**
   * Start message listener for the given platform auth.
   */
  abstract startListener(platformAuthId: string): Promise<void>;

  /**
   * Stop message listener.
   */
  abstract stopListener(platformAuthId: string): Promise<void>;

  /**
   * Get current listener state.
   */
  abstract getListenerState(platformAuthId: string): Promise<ListenerState>;
}
