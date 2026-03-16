import { DataSource } from 'typeorm';

// Used by TypeORM CLI (migration:generate, migration:run). Loads from process.env.
const isProduction = process.env.NODE_ENV === 'production';
const useSSL = process.env.DB_SSL === 'true' || (process.env.DB_SSL === undefined && isProduction);

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'digital_twin',
  password: process.env.DB_PASSWORD ?? 'dev_password',
  database: process.env.DB_DATABASE ?? 'digital_twin',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
  synchronize: false,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

export default dataSource;
