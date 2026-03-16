import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const db = this.config.get('database');
    const isProduction = this.config.get('nodeEnv') === 'production';
    const sslExplicit = this.config.get<boolean>('dbSsl');
    const useSSL = sslExplicit ?? isProduction;
    return {
      type: 'postgres',
      host: db?.host ?? 'localhost',
      port: db?.port ?? 5432,
      username: db?.username ?? 'digital_twin',
      password: db?.password ?? 'dev_password',
      database: db?.database ?? 'digital_twin',
      autoLoadEntities: true,
      synchronize: !isProduction && this.config.get('nodeEnv') === 'development',
      logging: !isProduction && this.config.get('nodeEnv') === 'development',
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    };
  }
}

