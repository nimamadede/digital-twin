import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.string().default('3000'),

  // PostgreSQL
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.string().default('5432'),
  DB_USERNAME: Joi.string().default('digital_twin'),
  DB_PASSWORD: Joi.string().default('dev_password'),
  DB_DATABASE: Joi.string().default('digital_twin'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.string().default('6379'),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.string().default('0'),

  // JWT (optional for dev)
  JWT_SECRET: Joi.string().min(16).optional(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  JWT_REFRESH_SECRET: Joi.string().min(16).optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  // MinIO
  MINIO_ENDPOINT: Joi.string().default('localhost'),
  MINIO_PORT: Joi.string().default('9000'),
  MINIO_USE_SSL: Joi.string().valid('true', 'false').default('false'),
  MINIO_ACCESS_KEY: Joi.string().default('minioadmin'),
  MINIO_SECRET_KEY: Joi.string().default('minioadmin'),
  MINIO_BUCKET: Joi.string().default('digital-twin'),

  // Qdrant
  QDRANT_URL: Joi.string().default('http://localhost:6333'),
  QDRANT_API_KEY: Joi.string().allow('').optional(),

  // AI (optional)
  ANTHROPIC_API_KEY: Joi.string().allow('').optional(),
});

export type ValidationSchema = Joi.ObjectSchema<typeof validationSchema>;
