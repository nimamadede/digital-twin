import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BullRootModuleOptions,
  SharedBullConfigurationFactory,
} from '@nestjs/bullmq';

@Injectable()
export class RedisConfigService implements SharedBullConfigurationFactory {
  constructor(private readonly config: ConfigService) {}

  createSharedConfiguration(): BullRootModuleOptions {
    const redis = this.config.get('redis');
    return {
      connection: {
        host: redis?.host ?? 'localhost',
        port: redis?.port ?? 6379,
        password: redis?.password,
        db: redis?.db ?? 0,
      },
    };
  }
}
