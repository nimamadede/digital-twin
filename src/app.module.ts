import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { validationSchema } from './config/validation-schema';
import configuration from './config/configuration';
import { DatabaseConfigService } from './config/database.config';
import { RedisConfigService } from './config/redis.config';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ContactModule } from './contact/contact.module';
import { SceneModule } from './scene/scene.module';
import { StorageModule } from './storage/storage.module';
import { StyleModule } from './style/style.module';
import { ReplyModule } from './reply/reply.module';
import { MessageModule } from './message/message.module';
import { PlatformModule } from './platform/platform.module';
import { NotificationModule } from './notification/notification.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfigService,
    }),
    BullModule.forRootAsync({
      useClass: RedisConfigService,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 60,
      },
    ]),
    TerminusModule,
    CommonModule,
    AuthModule,
    ContactModule,
    SceneModule,
    StorageModule,
    StyleModule,
    ReplyModule,
    MessageModule,
    PlatformModule,
    NotificationModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
