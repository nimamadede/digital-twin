import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export function createRedisClient(config: ConfigService): Redis {
  const redis = config.get('redis');
  return new Redis({
    host: redis?.host ?? 'localhost',
    port: redis?.port ?? 6379,
    password: redis?.password,
    db: redis?.db ?? 0,
  });
}
