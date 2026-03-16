import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
  ) {}

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: [],
    });
  }

  async findByIdWithSettings(
    id: string,
  ): Promise<{ user: User | null; settings: UserSettings | null }> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return { user: null, settings: null };
    const settings = await this.settingsRepo.findOne({ where: { userId: id } });
    return { user, settings };
  }

  async createUser(data: {
    phone: string;
    password: string;
    nickname: string;
    avatarUrl?: string | null;
  }): Promise<User> {
    const existing = await this.findByPhone(data.phone);
    if (existing) throw new ConflictException('PHONE_ALREADY_EXISTS');
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = this.userRepo.create({
      phone: data.phone,
      passwordHash,
      nickname: data.nickname,
      avatarUrl: data.avatarUrl ?? null,
      status: 'active',
    });
    const saved = await this.userRepo.save(user);
    await this.settingsRepo.save(
      this.settingsRepo.create({
        userId: saved.id,
        autoReply: true,
        notificationEnabled: true,
        reviewTimeout: 300,
        language: 'zh-CN',
      }),
    );
    return saved;
  }

  async updateLastLoginAt(userId: string): Promise<void> {
    await this.userRepo.update(userId, { lastLoginAt: new Date() });
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.update(userId, { passwordHash: hash });
  }

  async validatePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Get current user with settings (excluding password). For GET /users/me.
   */
  async getMe(
    userId: string,
  ): Promise<Omit<User, 'passwordHash'> & { settings: UserSettings | null }> {
    const { user, settings } = await this.findByIdWithSettings(userId);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    const { passwordHash: _p, ...rest } = user;
    return { ...rest, settings };
  }

  /**
   * Update current user profile (nickname, avatar, bio). Returns user without password.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    const updates: Partial<User> = {};
    if (dto.nickname !== undefined) updates.nickname = dto.nickname;
    if (dto.avatar !== undefined) updates.avatarUrl = dto.avatar;
    if (dto.bio !== undefined) updates.bio = dto.bio;
    if (Object.keys(updates).length > 0) {
      await this.userRepo.update(userId, updates);
    }
    const updated = await this.userRepo.findOne({ where: { id: userId } });
    if (!updated) throw new NotFoundException('USER_NOT_FOUND');
    const { passwordHash: _p, ...rest } = updated;
    return rest;
  }

  /**
   * Update current user settings. Returns updated settings.
   */
  async updateSettings(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<UserSettings> {
    let settings = await this.settingsRepo.findOne({ where: { userId } });
    if (!settings) {
      settings = this.settingsRepo.create({
        userId,
        autoReply: true,
        notificationEnabled: true,
        reviewTimeout: 300,
        language: 'zh-CN',
      });
      settings = await this.settingsRepo.save(settings);
    }
    const updates: Partial<UserSettings> = {};
    if (dto.defaultSceneId !== undefined)
      updates.defaultSceneId = dto.defaultSceneId;
    if (dto.autoReply !== undefined) updates.autoReply = dto.autoReply;
    if (dto.notificationEnabled !== undefined)
      updates.notificationEnabled = dto.notificationEnabled;
    if (dto.reviewTimeout !== undefined)
      updates.reviewTimeout = dto.reviewTimeout;
    if (dto.language !== undefined) updates.language = dto.language;
    if (Object.keys(updates).length > 0) {
      await this.settingsRepo.update(settings.id, updates);
      const updated = await this.settingsRepo.findOne({
        where: { id: settings.id },
      });
      if (updated) settings = updated;
    }
    return settings;
  }
}
