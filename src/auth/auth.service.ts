import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_CLIENT } from '../config/redis.provider';
import { UserService } from '../user/user.service';
import type {
  JwtAccessPayload,
  JwtRefreshPayload,
} from './interfaces/jwt-payload.interface';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';

const SMS_TTL = 300;
const ACCESS_TOKEN_EXPIRES_SEC = 900;
const MOCK_SMS_CODE_DEV = '123456';

function maskPhone(phone: string): string {
  if (phone.length < 11) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

@Injectable()
export class AuthService {
  private readonly isDev: boolean;
  private readonly refreshExpiresSec: number;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly userService: UserService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.isDev = this.config.get('nodeEnv') === 'development';
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
    this.refreshExpiresSec = this.parseExpiresToSeconds(refreshExpiresIn);
  }

  private parseExpiresToSeconds(expires: string): number {
    const match = expires.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 3600;
    const n = parseInt(match[1], 10);
    const u = match[2];
    const map: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (map[u] ?? 86400);
  }

  async sendSms(phone: string, purpose: string): Promise<{ expireIn: number }> {
    if (!this.isDev) {
      throw new Error('SMS provider not configured for production');
    }
    const code = MOCK_SMS_CODE_DEV;
    const key = `sms:${purpose}:${phone}`;
    await this.redis.setex(key, SMS_TTL, code);
    return { expireIn: SMS_TTL };
  }

  private async getStoredCode(phone: string, purpose: string): Promise<string | null> {
    const key = `sms:${purpose}:${phone}`;
    return this.redis.get(key);
  }

  async register(dto: RegisterDto): Promise<{
    userId: string;
    phone: string;
    nickname: string;
    createdAt: Date;
  }> {
    const code = await this.getStoredCode(dto.phone, 'register');
    if (!code || code !== dto.verifyCode) {
      throw new BadRequestException('INVALID_VERIFY_CODE');
    }
    const user = await this.userService.createUser({
      phone: dto.phone,
      password: dto.password,
      nickname: dto.nickname,
    });
    await this.redis.del(`sms:register:${dto.phone}`);
    return {
      userId: user.id,
      phone: maskPhone(user.phone),
      nickname: user.nickname,
      createdAt: user.createdAt,
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: { id: string; phone: string; nickname: string; avatarUrl: string | null; createdAt: Date };
  }> {
    const user = await this.userService.findByPhone(dto.phone);
    if (!user) throw new UnauthorizedException('INVALID_CREDENTIALS');
    const ok = await this.userService.validatePassword(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('INVALID_CREDENTIALS');
    if (user.status !== 'active') throw new UnauthorizedException('ACCOUNT_DISABLED');
    await this.userService.updateLastLoginAt(user.id);
    const { accessToken, refreshToken, jti } = await this.issueTokenPair(user.id, user.phone);
    await this.storeRefreshToken(jti, user.id);
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_SEC,
      user: {
        id: user.id,
        phone: maskPhone(user.phone),
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    };
  }

  private async issueTokenPair(
    userId: string,
    phone: string,
  ): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    const secret = this.config.get<string>('jwt.secret');
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');
    const jti = uuidv4();
    const accessToken = this.jwt.sign(
      { sub: userId, phone, type: 'access' } satisfies JwtAccessPayload,
      { secret, expiresIn: ACCESS_TOKEN_EXPIRES_SEC },
    );
    const refreshToken = this.jwt.sign(
      { sub: userId, phone, type: 'refresh', jti } satisfies JwtRefreshPayload,
      { secret: refreshSecret, expiresIn: this.refreshExpiresSec },
    );
    return { accessToken, refreshToken, jti };
  }

  private async storeRefreshToken(jti: string, userId: string): Promise<void> {
    await this.redis.setex(`refresh:${jti}`, this.refreshExpiresSec, userId);
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwt.verify(refreshToken, { secret: refreshSecret }) as JwtRefreshPayload;
    } catch {
      throw new UnauthorizedException('TOKEN_EXPIRED');
    }
    if (payload.type !== 'refresh' || !payload.jti) throw new UnauthorizedException('TOKEN_EXPIRED');
    const stored = await this.redis.get(`refresh:${payload.jti}`);
    if (!stored || stored !== payload.sub) throw new UnauthorizedException('TOKEN_EXPIRED');
    await this.redis.del(`refresh:${payload.jti}`);
    const pair = await this.issueTokenPair(payload.sub, payload.phone);
    await this.storeRefreshToken(pair.jti, payload.sub);
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_SEC,
    };
  }

  async logout(refreshToken: string | undefined, accessPayload: JwtAccessPayload): Promise<void> {
    if (refreshToken) {
      try {
        const refreshSecret = this.config.get<string>('jwt.refreshSecret');
        const payload = this.jwt.verify(refreshToken, { secret: refreshSecret }) as JwtRefreshPayload;
        if (payload.jti) await this.redis.del(`refresh:${payload.jti}`);
      } catch {
        // ignore invalid refresh
      }
    }
    // Optional: blacklist access token by jti if we had added jti to access token (we didn't)
  }

  async getMe(userId: string): Promise<{
    id: string;
    phone: string;
    nickname: string;
    avatarUrl: string | null;
    status: string;
    createdAt: Date;
    settings: { defaultSceneId: string | null; autoReply: boolean; notificationEnabled: boolean };
  }> {
    const { user, settings } = await this.userService.findByIdWithSettings(userId);
    if (!user) throw new UnauthorizedException('UNAUTHORIZED');
    return {
      id: user.id,
      phone: maskPhone(user.phone),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
      settings: {
        defaultSceneId: settings?.defaultSceneId ?? null,
        autoReply: settings?.autoReply ?? true,
        notificationEnabled: settings?.notificationEnabled ?? true,
      },
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('UNAUTHORIZED');
    const ok = await this.userService.validatePassword(dto.oldPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('INVALID_CREDENTIALS');
    await this.userService.updatePassword(userId, dto.newPassword);
  }
}
