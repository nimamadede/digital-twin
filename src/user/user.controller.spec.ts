import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { NotFoundException } from '@nestjs/common';

const userId = 'user-uuid-1';

const mockUserWithoutPassword = {
  id: userId,
  phone: '13900001234',
  nickname: 'TestUser',
  avatarUrl: null,
  bio: null,
  status: 'active',
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSettings = {
  id: 'settings-uuid-1',
  userId,
  defaultSceneId: null,
  defaultProfileId: null,
  autoReply: true,
  notificationEnabled: true,
  reviewTimeout: 300,
  language: 'zh-CN',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUserService = {
    getMe: jest.fn(),
    updateProfile: jest.fn(),
    updateSettings: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('should return current user with settings', async () => {
      mockUserService.getMe.mockResolvedValue({
        ...mockUserWithoutPassword,
        settings: mockSettings,
      });

      const result = await controller.getMe(userId);

      expect(userService.getMe).toHaveBeenCalledWith(userId);
      expect(result).toMatchObject({
        id: userId,
        nickname: 'TestUser',
        settings: mockSettings,
      });
    });
  });

  describe('updateProfile', () => {
    it('should update profile and return user without password', async () => {
      const dto = { nickname: 'NewNick', avatar: 'https://example.com/a.png' };
      mockUserService.updateProfile.mockResolvedValue({
        ...mockUserWithoutPassword,
        nickname: 'NewNick',
        avatarUrl: 'https://example.com/a.png',
      });

      const result = await controller.updateProfile(userId, dto);

      expect(userService.updateProfile).toHaveBeenCalledWith(userId, dto);
      expect(result.nickname).toBe('NewNick');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw when user not found', async () => {
      mockUserService.updateProfile.mockRejectedValue(
        new NotFoundException('USER_NOT_FOUND'),
      );

      await expect(
        controller.updateProfile(userId, { nickname: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSettings', () => {
    it('should update settings and return updated settings', async () => {
      const dto = { autoReply: false, language: 'en-US' };
      mockUserService.updateSettings.mockResolvedValue({
        ...mockSettings,
        autoReply: false,
        language: 'en-US',
      });

      const result = await controller.updateSettings(userId, dto);

      expect(userService.updateSettings).toHaveBeenCalledWith(userId, dto);
      expect(result.autoReply).toBe(false);
      expect(result.language).toBe('en-US');
    });
  });
});
