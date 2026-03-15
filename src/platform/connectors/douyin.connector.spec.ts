import { DouyinConnector } from './douyin.connector';

jest.mock('uuid', () => ({
  v4: () => 'mock-douyin-uuid',
}));

describe('DouyinConnector', () => {
  let connector: DouyinConnector;

  beforeEach(() => {
    DouyinConnector.clearMockState();
    connector = new DouyinConnector();
  });

  describe('authorize', () => {
    it('should create pending auth and return authId', async () => {
      const result = await connector.authorize('user-1', 'qrcode');

      expect(result.authId).toBe('mock-douyin-uuid');
      expect(result.status).toBe('waiting_scan');
      expect(result.expiresIn).toBe(300);
    });

    it('should return OAuth URL for qrcode when config is set', async () => {
      connector.setConfig({
        clientKey: 'dy_client_key',
        clientSecret: 'dy_client_secret',
        callbackUrl: 'https://example.com/douyin/callback',
      });

      const result = await connector.authorize('user-1', 'qrcode');

      expect(result.qrcodeUrl).toContain('open.douyin.com');
      expect(result.qrcodeUrl).toContain('dy_client_key');
    });

    it('should return undefined qrcodeUrl for token auth type', async () => {
      const result = await connector.authorize('user-1', 'token');

      expect(result.qrcodeUrl).toBeUndefined();
    });
  });

  describe('getAuthStatus', () => {
    it('should return expired for unknown authId', async () => {
      const result = await connector.getAuthStatus('user-1', 'unknown');

      expect(result.status).toBe('expired');
    });

    it('should return failed when userId does not match', async () => {
      await connector.authorize('user-1', 'qrcode');

      const result = await connector.getAuthStatus('user-2', 'mock-douyin-uuid');

      expect(result.status).toBe('failed');
    });

    it('should return waiting_scan initially', async () => {
      await connector.authorize('user-1', 'qrcode');

      const status = await connector.getAuthStatus('user-1', 'mock-douyin-uuid');

      expect(status.status).toBe('waiting_scan');
    });
  });

  describe('listener lifecycle', () => {
    const authId = 'platform-auth-1';

    it('should start listener', async () => {
      await connector.startListener(authId);

      const state = await connector.getListenerState(authId);
      expect(state.isListening).toBe(true);
      expect(state.startedAt).toBeDefined();
    });

    it('should stop listener', async () => {
      await connector.startListener(authId);
      await connector.stopListener(authId);

      const state = await connector.getListenerState(authId);
      expect(state.isListening).toBe(false);
    });

    it('should return default state for unknown platformAuthId', async () => {
      const state = await connector.getListenerState('unknown');

      expect(state.isListening).toBe(false);
      expect(state.startedAt).toBeNull();
      expect(state.messagesReceived).toBe(0);
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should return null without config', async () => {
      const result = await connector.exchangeCodeForToken('test-code');
      expect(result).toBeNull();
    });

    it('should return mock token with config', async () => {
      connector.setConfig({
        clientKey: 'key',
        clientSecret: 'secret',
        callbackUrl: 'https://example.com/callback',
      });

      const result = await connector.exchangeCodeForToken('test-code');
      expect(result?.accessToken).toBe('mock-douyin-token');
      expect(result?.openId).toBe('mock-open-id');
    });
  });

  describe('consumePendingAuth', () => {
    it('should remove pending auth', async () => {
      await connector.authorize('user-1', 'qrcode');
      connector.consumePendingAuth('mock-douyin-uuid');

      const status = await connector.getAuthStatus('user-1', 'mock-douyin-uuid');
      expect(status.status).toBe('expired');
    });
  });
});
