import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MessageListenerService } from './message-listener.service';
import { PlatformAuth } from '../entities/platform-auth.entity';
import { PLATFORM_CONNECTOR_REGISTRY } from './message-listener.service';
import type { BaseConnector } from '../connectors/base.connector';

const userId = 'user-uuid-1';
const platformAuthId = 'auth-uuid-1';

const mockAuth: PlatformAuth = {
  id: platformAuthId,
  userId,
  platform: 'wechat',
  accountNickname: null,
  accountAvatar: null,
  accessToken: 'token',
  refreshToken: null,
  tokenExpiresAt: null,
  status: 'connected',
  config: {},
  lastActiveAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as PlatformAuth;

const mockConnector: BaseConnector = {
  platform: 'wechat',
  authorize: jest.fn(),
  getAuthStatus: jest.fn(),
  startListener: jest.fn().mockResolvedValue(undefined),
  stopListener: jest.fn().mockResolvedValue(undefined),
  getListenerState: jest.fn().mockResolvedValue({
    isListening: true,
    startedAt: '2026-03-14T10:00:00.000Z',
    messagesReceived: 42,
    messagesProcessed: 38,
    errors: 0,
  }),
};

describe('MessageListenerService', () => {
  let service: MessageListenerService;
  let repo: Repository<PlatformAuth>;
  let connectors: Map<string, BaseConnector>;

  beforeEach(async () => {
    connectors = new Map([['wechat', mockConnector]]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageListenerService,
        {
          provide: getRepositoryToken(PlatformAuth),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: PLATFORM_CONNECTOR_REGISTRY,
          useValue: connectors,
        },
      ],
    }).compile();

    service = module.get<MessageListenerService>(MessageListenerService);
    repo = module.get<Repository<PlatformAuth>>(getRepositoryToken(PlatformAuth));
    jest.clearAllMocks();
  });

  describe('getState', () => {
    it('should return listener state when auth found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockAuth);

      const result = await service.getState(userId, platformAuthId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: platformAuthId, userId },
      });
      expect(result.isListening).toBe(true);
      expect(result.messagesReceived).toBe(42);
      expect(result.messagesProcessed).toBe(38);
    });

    it('should throw NotFoundException when auth not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getState(userId, platformAuthId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('start', () => {
    it('should call connector startListener when auth found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockAuth);

      await service.start(userId, platformAuthId);

      expect(mockConnector.startListener).toHaveBeenCalledWith(platformAuthId);
    });

    it('should throw NotFoundException when auth not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.start(userId, platformAuthId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('stop', () => {
    it('should call connector stopListener when auth found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockAuth);

      await service.stop(userId, platformAuthId);

      expect(mockConnector.stopListener).toHaveBeenCalledWith(platformAuthId);
    });
  });
});
