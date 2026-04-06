import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { REDIS_CLIENT } from '../config/redis.provider';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-v4',
}));

const userId = 'user-uuid-1';
const phone = '13900001234';
const nickname = 'TestUser';

const mockUser = {
  id: userId,
  phone,
  nickname,
  passwordHash: '$2b$10$hashedpassword',
  avatarUrl: null,
  status: 'active',
  createdAt: new Date('2025-01-01'),
  lastLoginAt: null,
};

const mockSettings = {
  userId,
  defaultSceneId: null,
  autoReply: true,
  notificationEnabled: true,
  reviewTimeout: 300,
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;

  const mockRedis = {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const map: Record<string, unknown> = {
        nodeEnv: 'development',
        'jwt.secret': 'test-jwt-secret',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiresIn': '30d',
        'jwt.expiresIn': '15m',
      };
      return map[key];
    }),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn(),
  };

  const mockUserService = {
    createUser: jest.fn(),
    findByPhone: jest.fn(),
    findById: jest.fn(),
    findByIdWithSettings: jest.fn(),
    validatePassword: jest.fn(),
    updateLastLoginAt: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: UserService, useValue: mockUserService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  describe('sendSms', () => {
    beforeEach(() => {
      mockRedis.incr.mockResolvedValue(1);
    });

    it('should store code in Redis and return expireIn', async () => {
      const result = await service.sendSms(phone, 'register');

      expect(mockRedis.incr).toHaveBeenCalledWith(`sms:phone_hour:${phone}`);
      expect(mockRedis.expire).toHaveBeenCalledWith(`sms:phone_hour:${phone}`, 3600);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `sms:register:${phone}`,
        300,
        '123456', // dev mode fixed code
      );
      expect(result).toEqual({ expireIn: 300 });
    });

    it('should use different key for different purposes', async () => {
      await service.sendSms(phone, 'login');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `sms:login:${phone}`,
        300,
        expect.any(String),
      );
    });

    it('should reject when per-phone hourly limit exceeded', async () => {
      mockRedis.incr.mockResolvedValueOnce(11);

      await expect(service.sendSms(phone, 'register')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should reject in production until SMS provider is wired', async () => {
      mockRedis.incr.mockClear();
      mockRedis.setex.mockClear();
      const prodConfig = {
        get: jest.fn((key: string) => {
          if (key === 'nodeEnv') return 'production';
          const map: Record<string, unknown> = {
            'jwt.secret': 'test-jwt-secret',
            'jwt.refreshSecret': 'test-refresh-secret',
            'jwt.refreshExpiresIn': '30d',
            'jwt.expiresIn': '15m',
          };
          return map[key];
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: ConfigService, useValue: prodConfig },
          { provide: JwtService, useValue: mockJwtService },
          { provide: UserService, useValue: mockUserService },
          { provide: REDIS_CLIENT, useValue: mockRedis },
        ],
      }).compile();
      const prodService = mod.get<AuthService>(AuthService);

      await expect(prodService.sendSms(phone, 'register')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRedis.incr).not.toHaveBeenCalled();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const registerDto = {
      phone,
      password: 'TestPass1',
      nickname,
      verifyCode: '123456',
    };

    it('should register user when verify code is valid', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockUserService.createUser.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(mockRedis.get).toHaveBeenCalledWith(`sms:register:${phone}`);
      expect(mockUserService.createUser).toHaveBeenCalledWith({
        phone,
        password: 'TestPass1',
        nickname,
      });
      expect(mockRedis.del).toHaveBeenCalledWith(`sms:register:${phone}`);
      expect(result.userId).toBe(userId);
      expect(result.nickname).toBe(nickname);
      expect(result.phone).toBe('139****1234'); // masked
      expect(result.createdAt).toBeDefined();
    });

    it('should throw BadRequestException when verify code is wrong', async () => {
      mockRedis.get.mockResolvedValue('654321');

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserService.createUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when verify code is expired (null)', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate ConflictException when phone already exists', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockUserService.createUser.mockRejectedValue(
        new ConflictException('PHONE_ALREADY_EXISTS'),
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const loginDto = { phone, password: 'TestPass1' };

    it('should return tokens and user info on successful login', async () => {
      mockUserService.findByPhone.mockResolvedValue(mockUser);
      mockUserService.validatePassword.mockResolvedValue(true);
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(loginDto);

      expect(mockUserService.findByPhone).toHaveBeenCalledWith(phone);
      expect(mockUserService.validatePassword).toHaveBeenCalledWith(
        'TestPass1',
        mockUser.passwordHash,
      );
      expect(mockUserService.updateLastLoginAt).toHaveBeenCalledWith(userId);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.expiresIn).toBe(900);
      expect(result.user.id).toBe(userId);
      expect(result.user.phone).toBe('139****1234');
      expect(result.user.nickname).toBe(nickname);
    });

    it('should store refresh token jti in Redis', async () => {
      mockUserService.findByPhone.mockResolvedValue(mockUser);
      mockUserService.validatePassword.mockResolvedValue(true);

      await service.login(loginDto);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:/),
        expect.any(Number),
        userId,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserService.findByPhone.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUserService.validatePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      mockUserService.findByPhone.mockResolvedValue(mockUser);
      mockUserService.validatePassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUserService.updateLastLoginAt).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when account is disabled', async () => {
      mockUserService.findByPhone.mockResolvedValue({
        ...mockUser,
        status: 'disabled',
      });
      mockUserService.validatePassword.mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('should issue new token pair and rotate refresh jti', async () => {
      const oldJti = 'old-jti-uuid';
      mockJwtService.verify.mockReturnValue({
        sub: userId,
        phone,
        type: 'refresh',
        jti: oldJti,
      });
      mockRedis.get.mockResolvedValue(userId);
      mockJwtService.sign
        .mockReturnValueOnce('new-access')
        .mockReturnValueOnce('new-refresh');

      const result = await service.refresh('old-refresh-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('old-refresh-token', {
        secret: 'test-refresh-secret',
      });
      expect(mockRedis.get).toHaveBeenCalledWith(`refresh:${oldJti}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${oldJti}`);
      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
      expect(result.expiresIn).toBe(900);
    });

    it('should throw UnauthorizedException when token verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token type is not refresh', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: userId,
        phone,
        type: 'access',
      });

      await expect(service.refresh('access-as-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when jti not found in Redis', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: userId,
        phone,
        type: 'refresh',
        jti: 'unknown-jti',
      });
      mockRedis.get.mockResolvedValue(null);

      await expect(service.refresh('stolen-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when stored userId does not match token sub', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: userId,
        phone,
        type: 'refresh',
        jti: 'some-jti',
      });
      mockRedis.get.mockResolvedValue('different-user-id');

      await expect(service.refresh('tampered-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    const accessPayload = { sub: userId, phone, type: 'access' as const };

    it('should delete refresh token from Redis', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: userId,
        phone,
        type: 'refresh',
        jti: 'logout-jti',
      });

      await service.logout('refresh-token', accessPayload);

      expect(mockRedis.del).toHaveBeenCalledWith('refresh:logout-jti');
    });

    it('should not throw when refreshToken is undefined', async () => {
      await expect(
        service.logout(undefined, accessPayload),
      ).resolves.toBeUndefined();
    });

    it('should not throw when refresh token verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(
        service.logout('bad-token', accessPayload),
      ).resolves.toBeUndefined();
    });
  });

  describe('getMe', () => {
    it('should return user profile with settings', async () => {
      mockUserService.findByIdWithSettings.mockResolvedValue({
        user: mockUser,
        settings: mockSettings,
      });

      const result = await service.getMe(userId);

      expect(mockUserService.findByIdWithSettings).toHaveBeenCalledWith(userId);
      expect(result.id).toBe(userId);
      expect(result.phone).toBe('139****1234');
      expect(result.nickname).toBe(nickname);
      expect(result.status).toBe('active');
      expect(result.settings.autoReply).toBe(true);
      expect(result.settings.notificationEnabled).toBe(true);
    });

    it('should return default settings when settings is null', async () => {
      mockUserService.findByIdWithSettings.mockResolvedValue({
        user: mockUser,
        settings: null,
      });

      const result = await service.getMe(userId);

      expect(result.settings.defaultSceneId).toBeNull();
      expect(result.settings.autoReply).toBe(true);
      expect(result.settings.notificationEnabled).toBe(true);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserService.findByIdWithSettings.mockResolvedValue({
        user: null,
        settings: null,
      });

      await expect(service.getMe(userId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    const dto = { oldPassword: 'OldPass1', newPassword: 'NewPass1' };

    it('should update password when old password is correct', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      mockUserService.validatePassword.mockResolvedValue(true);

      await service.changePassword(userId, dto);

      expect(mockUserService.findById).toHaveBeenCalledWith(userId);
      expect(mockUserService.validatePassword).toHaveBeenCalledWith(
        'OldPass1',
        mockUser.passwordHash,
      );
      expect(mockUserService.updatePassword).toHaveBeenCalledWith(
        userId,
        'NewPass1',
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserService.findById.mockResolvedValue(null);

      await expect(service.changePassword(userId, dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUserService.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when old password is wrong', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      mockUserService.validatePassword.mockResolvedValue(false);

      await expect(service.changePassword(userId, dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUserService.updatePassword).not.toHaveBeenCalled();
    });
  });
});
