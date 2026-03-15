import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashed'),
  compare: jest.fn(),
}));

const userId = 'user-uuid-1';
const phone = '13900001234';

const mockUser = {
  id: userId,
  phone,
  nickname: 'TestUser',
  passwordHash: '$2b$10$existing_hash',
  avatarUrl: null,
  status: 'active',
  createdAt: new Date(),
  lastLoginAt: null,
} as unknown as User;

const mockSettings = {
  userId,
  autoReply: true,
  notificationEnabled: true,
  reviewTimeout: 300,
  language: 'zh-CN',
} as unknown as UserSettings;

describe('UserService', () => {
  let service: UserService;

  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn((dto) => ({ ...dto, id: userId })),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockSettingsRepo = {
    findOne: jest.fn(),
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn().mockResolvedValue(mockSettings),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserSettings), useValue: mockSettingsRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  describe('findByPhone', () => {
    it('should return user when found', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findByPhone(phone);

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { phone } });
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.findByPhone('13800000000');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(userId);

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        relations: [],
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithSettings', () => {
    it('should return user with settings', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockSettingsRepo.findOne.mockResolvedValue(mockSettings);

      const result = await service.findByIdWithSettings(userId);

      expect(result.user).toEqual(mockUser);
      expect(result.settings).toEqual(mockSettings);
    });

    it('should return null user and settings when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.findByIdWithSettings('non-existent');

      expect(result.user).toBeNull();
      expect(result.settings).toBeNull();
      expect(mockSettingsRepo.findOne).not.toHaveBeenCalled();
    });

    it('should return user with null settings when settings not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockSettingsRepo.findOne.mockResolvedValue(null);

      const result = await service.findByIdWithSettings(userId);

      expect(result.user).toEqual(mockUser);
      expect(result.settings).toBeNull();
    });
  });

  describe('createUser', () => {
    const createData = {
      phone,
      password: 'TestPass1',
      nickname: 'NewUser',
    };

    it('should hash password and create user with settings', async () => {
      mockUserRepo.findOne.mockResolvedValue(null); // no existing user
      mockUserRepo.save.mockResolvedValue({ ...mockUser, nickname: 'NewUser' });

      const result = await service.createUser(createData);

      expect(bcrypt.hash).toHaveBeenCalledWith('TestPass1', 10);
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          passwordHash: '$2b$10$hashed',
          nickname: 'NewUser',
          avatarUrl: null,
          status: 'active',
        }),
      );
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockSettingsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          autoReply: true,
          notificationEnabled: true,
          reviewTimeout: 300,
          language: 'zh-CN',
        }),
      );
      expect(mockSettingsRepo.save).toHaveBeenCalled();
      expect(result.nickname).toBe('NewUser');
    });

    it('should throw ConflictException when phone already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(service.createUser(createData)).rejects.toThrow(
        ConflictException,
      );
      expect(mockUserRepo.save).not.toHaveBeenCalled();
    });

    it('should set avatarUrl to null when not provided', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.save.mockResolvedValue(mockUser);

      await service.createUser(createData);

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: null }),
      );
    });

    it('should use provided avatarUrl', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.save.mockResolvedValue(mockUser);

      await service.createUser({ ...createData, avatarUrl: 'https://example.com/avatar.png' });

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: 'https://example.com/avatar.png' }),
      );
    });
  });

  describe('updateLastLoginAt', () => {
    it('should update lastLoginAt timestamp', async () => {
      await service.updateLastLoginAt(userId);

      expect(mockUserRepo.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      );
    });
  });

  describe('updatePassword', () => {
    it('should hash new password and update', async () => {
      await service.updatePassword(userId, 'NewPass1');

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass1', 10);
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        userId,
        { passwordHash: '$2b$10$hashed' },
      );
    });
  });

  describe('validatePassword', () => {
    it('should return true when password matches', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword('password', '$2b$10$hash');

      expect(bcrypt.compare).toHaveBeenCalledWith('password', '$2b$10$hash');
      expect(result).toBe(true);
    });

    it('should return false when password does not match', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword('wrong', '$2b$10$hash');

      expect(result).toBe(false);
    });
  });
});
