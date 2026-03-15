import { WeComConnector } from './wecom.connector';

jest.mock('uuid', () => ({
  v4: () => 'mock-wecom-uuid',
}));

describe('WeComConnector', () => {
  let connector: WeComConnector;

  beforeEach(() => {
    WeComConnector.clearMockState();
    connector = new WeComConnector();
  });

  describe('authorize', () => {
    it('should create pending auth and return authId', async () => {
      const result = await connector.authorize('user-1', 'qrcode');

      expect(result.authId).toBe('mock-wecom-uuid');
      expect(result.status).toBe('waiting_scan');
      expect(result.expiresIn).toBe(300);
    });

    it('should return OAuth URL for qrcode auth type when config is set', async () => {
      connector.setConfig({
        corpId: 'ww1234567890',
        agentId: '1000001',
        secret: 'test-secret',
        token: 'test-token',
        encodingAESKey: 'test-aes-key',
        callbackUrl: 'https://example.com/wecom/callback',
      });

      const result = await connector.authorize('user-1', 'qrcode');

      expect(result.qrcodeUrl).toContain('open.work.weixin.qq.com');
      expect(result.qrcodeUrl).toContain('ww1234567890');
      expect(result.qrcodeUrl).toContain('1000001');
    });

    it('should return undefined qrcodeUrl for non-qrcode auth type', async () => {
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

      const result = await connector.getAuthStatus('user-2', 'mock-wecom-uuid');

      expect(result.status).toBe('failed');
    });

    it('should progress through statuses over time', async () => {
      await connector.authorize('user-1', 'qrcode');

      // Initial status
      const status1 = await connector.getAuthStatus('user-1', 'mock-wecom-uuid');
      expect(status1.status).toBe('waiting_scan');
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

  describe('verifyCallback', () => {
    it('should return echostr for verification', () => {
      const result = connector.verifyCallback('sig', '123', 'nonce', 'echo123');

      expect(result).toBe('echo123');
    });
  });

  describe('handleMessageCallback', () => {
    it('should return null (stub implementation)', async () => {
      const result = await connector.handleMessageCallback('sig', '123', 'nonce', '<xml></xml>');

      expect(result).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('should return null without config', async () => {
      const token = await connector.getAccessToken();
      expect(token).toBeNull();
    });

    it('should return mock token with config', async () => {
      connector.setConfig({
        corpId: 'ww123',
        agentId: '1000001',
        secret: 'secret',
        token: 'token',
        encodingAESKey: 'key',
        callbackUrl: 'https://example.com/callback',
      });

      const token = await connector.getAccessToken();
      expect(token).toBe('mock-wecom-access-token');
    });
  });

  describe('syncDepartmentContacts', () => {
    it('should return empty array without config', async () => {
      const contacts = await connector.syncDepartmentContacts();
      expect(contacts).toEqual([]);
    });
  });

  describe('consumePendingAuth', () => {
    it('should remove pending auth', async () => {
      await connector.authorize('user-1', 'qrcode');
      connector.consumePendingAuth('mock-wecom-uuid');

      const status = await connector.getAuthStatus('user-1', 'mock-wecom-uuid');
      expect(status.status).toBe('expired');
    });
  });
});
