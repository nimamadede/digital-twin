import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default values when no env vars are set', () => {
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.DB_HOST;
    delete process.env.REDIS_HOST;
    delete process.env.JWT_SECRET;

    const config = configuration();

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.username).toBe('digital_twin');
    expect(config.database.password).toBe('dev_password');
    expect(config.database.database).toBe('digital_twin');
    expect(config.redis.host).toBe('localhost');
    expect(config.redis.port).toBe(6379);
    expect(config.redis.db).toBe(0);
    expect(config.jwt.secret).toContain('dev-jwt-secret');
    expect(config.jwt.expiresIn).toBe('7d');
    expect(config.jwt.refreshSecret).toContain('dev-refresh-secret');
    expect(config.jwt.refreshExpiresIn).toBe('30d');
    expect(config.minio.endPoint).toBe('localhost');
    expect(config.minio.port).toBe(9000);
    expect(config.minio.useSSL).toBe(false);
    expect(config.minio.accessKey).toBe('minioadmin');
    expect(config.minio.secretKey).toBe('minioadmin');
    expect(config.minio.bucket).toBe('digital-twin');
    expect(config.qdrant.url).toBe('http://localhost:6333');
    expect(config.ai.defaultModel).toContain('claude');
    expect(config.ai.maxTokens).toBe(1024);
  });

  it('should use env vars when set', () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8080';
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'prod_user';
    process.env.DB_PASSWORD = 'prod_pass';
    process.env.DB_DATABASE = 'prod_db';
    process.env.REDIS_HOST = 'redis.example.com';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'redis_pass';
    process.env.REDIS_DB = '2';
    process.env.JWT_SECRET = 'production-secret-key-12345';
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.JWT_REFRESH_SECRET = 'prod-refresh-secret-12345';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const config = configuration();

    expect(config.nodeEnv).toBe('production');
    expect(config.port).toBe(8080);
    expect(config.database.host).toBe('db.example.com');
    expect(config.database.port).toBe(5433);
    expect(config.database.username).toBe('prod_user');
    expect(config.database.password).toBe('prod_pass');
    expect(config.database.database).toBe('prod_db');
    expect(config.redis.host).toBe('redis.example.com');
    expect(config.redis.port).toBe(6380);
    expect(config.redis.password).toBe('redis_pass');
    expect(config.redis.db).toBe(2);
    expect(config.jwt.secret).toBe('production-secret-key-12345');
    expect(config.jwt.expiresIn).toBe('1d');
    expect(config.jwt.refreshSecret).toBe('prod-refresh-secret-12345');
    expect(config.jwt.refreshExpiresIn).toBe('7d');
  });

  it('should handle MinIO SSL flag', () => {
    process.env.MINIO_USE_SSL = 'true';
    const config = configuration();
    expect(config.minio.useSSL).toBe(true);
  });

  it('should handle empty optional values', () => {
    process.env.REDIS_PASSWORD = '';
    process.env.QDRANT_API_KEY = '';
    process.env.ANTHROPIC_API_KEY = '';

    const config = configuration();

    expect(config.redis.password).toBeUndefined();
    expect(config.qdrant.apiKey).toBeUndefined();
    expect(config.ai.anthropicApiKey).toBeUndefined();
  });

  it('should parse numeric env vars correctly', () => {
    process.env.PORT = '4000';
    process.env.AI_MAX_TOKENS = '2048';
    process.env.MINIO_PORT = '9001';

    const config = configuration();

    expect(config.port).toBe(4000);
    expect(config.ai.maxTokens).toBe(2048);
    expect(config.minio.port).toBe(9001);
  });
});
