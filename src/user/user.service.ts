import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';

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
}
