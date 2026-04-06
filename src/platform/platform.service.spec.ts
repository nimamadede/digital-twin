import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PlatformService } from './platform.service';
import { PlatformAuth } from './entities/platform-auth.entity';
import { PLATFORM_CONNECTOR_REGISTRY } from './services/message-listener.service';
import type { BaseConnector } from './connectors/base.connector';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid-v4' }));

const userId = 'user-uuid-1';
const platformAuthId = 'auth-uuid-1';
const authId = 'pending-auth-id';

const mockPlatformAuth: PlatformAuth = {
  id: platformAuthId,
  userId,
  platform: 'wechat',
  accountNickname: '小明的微信',
  accountAvatar: 'https://example.com/avatar.png',
  accessToken: 'mock_token',
  refreshToken: null,
  tokenExpiresAt: null,
  status: 'connected',
  config: {},
  lastActiveAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
} as PlatformAuth;

const mockConnector = {
  platform: 'wechat',
  authorize: jest.fn().mockResolvedValue({
    authId,
    qrcodeUrl: 'https://example.com/qr',
    expiresIn: 300,
    status: 'waiting_scan',
  }),
  getAuthStatus: jest.fn().mockResolvedValue({
    authId,
    status: 'waiting_scan',
  }),
  startListener: jest.fn().mockResolvedValue(undefined),
  stopListener: jest.fn().mockResolvedValue(undefined),
  getListenerState: jest.fn().mockResolvedValue({
    isListening: false,
    startedAt: null,
    messagesReceived: 0,
    messagesProcessed: 0,
    errors: 0,
  }),
  sendTextMessage: jest.fn().mockResolvedValue(undefined),
  consumePendingAuth: jest.fn(),
} as unknown as BaseConnector;

describe('PlatformService', () => {
  let service: PlatformService;
  let repo: Repository<PlatformAuth>;
  let connectors: Map<string, BaseConnector>;

  beforeEach(async () => {
    connectors = new Map([['wechat', mockConnector]]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformService,
        {
          provide: getRepositoryToken(PlatformAuth),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: PLATFORM_CONNECTOR_REGISTRY,
          useValue: connectors,
        },
      ],
    }).compile();

    service = module.get<PlatformService>(PlatformService);
    repo = module.get<Repository<PlatformAuth>>(getRepositoryToken(PlatformAuth));
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should filter by userId and return platform list', async () => {
      (repo.find as jest.Mock).mockResolvedValue([mockPlatformAuth]);

      const result = await service.list(userId);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId, status: 'connected' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(platformAuthId);
      expect(result[0].platform).toBe('wechat');
      expect(result[0].displayName).toBe('微信');
      expect(result[0].status).toBe('connected');
      expect(result[0].accountInfo.nickname).toBe('小明的微信');
    });

    it('should return empty array when no platforms', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.list(userId);

      expect(result).toEqual([]);
    });
  });

  describe('sendOutboundText', () => {
    it('should call connector sendTextMessage when platform auth exists', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockPlatformAuth);

      await service.sendOutboundText(userId, 'wechat', 'openid-x', 'hello');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId, platform: 'wechat', status: 'connected' },
      });
      expect(mockConnector.sendTextMessage).toHaveBeenCalledWith('openid-x', 'hello');
    });

    it('should not call connector when no connected auth', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await service.sendOutboundText(userId, 'wechat', 'openid-x', 'hello');

      expect(mockConnector.sendTextMessage).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should call connector and return auth result', async () => {
      const result = await service.authorize(userId, 'wechat', 'qrcode');

      expect(mockConnector.authorize).toHaveBeenCalledWith(userId, 'qrcode');
      expect(result.authId).toBe(authId);
      expect(result.status).toBe('waiting_scan');
      expect(result.qrcodeUrl).toBe('https://example.com/qr');
      expect(result.expiresIn).toBe(300);
    });

    it('should return failed when platform has no connector', async () => {
      const result = await service.authorize(userId, 'unknown', 'qrcode');

      expect(result.status).toBe('failed');
      expect(result.authId).toBe('');
    });
  });

  describe('getAuthStatus', () => {
    it('should return expired when authId not in pending', async () => {
      (mockConnector.getAuthStatus as jest.Mock).mockResolvedValue({
        authId: 'other',
        status: 'expired',
      });

      const result = await service.getAuthStatus(userId, 'unknown-auth-id');

      expect(result.status).toBe('expired');
    });

    it('should create PlatformAuth and return platformAuthId when confirmed', async () => {
      await service.authorize(userId, 'wechat', 'qrcode');
      (mockConnector.getAuthStatus as jest.Mock).mockResolvedValue({
        authId,
        status: 'confirmed',
      });
      (repo.create as jest.Mock).mockImplementation((dto) => ({ ...dto, id: platformAuthId }));
      (repo.save as jest.Mock).mockResolvedValue({ ...mockPlatformAuth, id: platformAuthId });

      const result = await service.getAuthStatus(userId, authId);

      expect(result.status).toBe('confirmed');
      expect(result.platformAuthId).toBe(platformAuthId);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should remove platform auth when found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockPlatformAuth);

      await service.disconnect(userId, platformAuthId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: platformAuthId, userId },
      });
      expect(repo.remove).toHaveBeenCalledWith(mockPlatformAuth);
    });

    it('should throw NotFoundException when platform auth not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.disconnect(userId, platformAuthId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateConfig', () => {
    it('should merge dto into config and save', async () => {
      const auth = { ...mockPlatformAuth, config: { autoListen: false } };
      (repo.findOne as jest.Mock).mockResolvedValue(auth);
      (repo.save as jest.Mock).mockResolvedValue(auth);

      await service.updateConfig(userId, platformAuthId, {
        autoListen: true,
        messageTypes: ['text', 'image'],
      });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: platformAuthId, userId },
      });
      expect(auth.config).toEqual({
        autoListen: true,
        messageTypes: ['text', 'image'],
      });
      expect(repo.save).toHaveBeenCalledWith(auth);
    });

    it('should throw NotFoundException when platform auth not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateConfig(userId, platformAuthId, { autoListen: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
