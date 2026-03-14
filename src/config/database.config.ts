import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const db = this.config.get('database');
    return {
      type: 'postgres',
      host: db?.host ?? 'localhost',
      port: db?.port ?? 5432,
      username: db?.username ?? 'digital_twin',
      password: db?.password ?? 'dev_password',
      database: db?.database ?? 'digital_twin',
      autoLoadEntities: true,
      synchronize: this.config.get('nodeEnv') === 'development',
      logging: this.config.get('nodeEnv') === 'development',
    };
  }
}

