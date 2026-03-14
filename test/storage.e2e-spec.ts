import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * E2E: Upload file and get download link.
 * Requires: PostgreSQL, Redis, MinIO (e.g. docker-compose up -d).
 * Run: npm run test:e2e -- test/storage.e2e-spec.ts
 */
describe('Storage (e2e) - upload and get download link', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let fileId: string;

  const baseUrl = '/api/v1';
  const testPhone = '13800138000';
  const testPassword = 'TestPass123!';
  const testNickname = 'e2e-storage-user';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('1. send SMS then register user (or skip if already exists)', async () => {
    await request(app.getHttpServer())
      .post(`${baseUrl}/auth/sms/send`)
      .send({ phone: testPhone, purpose: 'register' })
      .expect(200);

    // In NODE_ENV=development, AuthService uses mock code 123456
    const registerRes = await request(app.getHttpServer())
      .post(`${baseUrl}/auth/register`)
      .send({
        phone: testPhone,
        password: testPassword,
        nickname: testNickname,
        verifyCode: '123456',
      });

    if (registerRes.status === 409) {
      return; // user already exists from previous run
    }
    if (registerRes.status === 400 && registerRes.body?.error === 'INVALID_VERIFY_CODE') {
      throw new Error('Run with NODE_ENV=development so mock SMS code 123456 is used (npm run test:e2e:storage)');
    }
    expect(registerRes.status).toBe(201);
  }, 15_000);

  it('2. login and get access token', async () => {
    const res = await request(app.getHttpServer())
      .post(`${baseUrl}/auth/login`)
      .send({ phone: testPhone, password: testPassword })
      .expect(200);

    const data = res.body.data ?? res.body;
    accessToken = data.accessToken ?? data.data?.accessToken;
    expect(accessToken).toBeDefined();
  }, 10_000);

  it('3. upload file and get fileId', async () => {
    const res = await request(app.getHttpServer())
      .post(`${baseUrl}/storage/upload`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('purpose', 'style_analysis')
      .attach('file', Buffer.from('hello e2e upload'), 'e2e-test.txt')
      .expect(201);

    const payload = res.body.data?.data ?? res.body.data ?? res.body;
    expect(payload).toMatchObject({
      fileName: expect.any(String),
      purpose: 'style_analysis',
      status: 'uploaded',
    });
    expect(payload.fileSize).toBeGreaterThan(0);
    fileId = payload.id;
    expect(fileId).toBeDefined();
  }, 15_000);

  it('4. get presigned download URL', async () => {
    expect(fileId).toBeDefined();
    const res = await request(app.getHttpServer())
      .get(`${baseUrl}/storage/files/${fileId}/download`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const payload = res.body.data?.data ?? res.body.data ?? res.body;
    expect(payload).toHaveProperty('downloadUrl');
    expect(payload.downloadUrl).toMatch(/^https?:\/\//);
    expect(payload.expiresIn).toBe(3600);
  }, 10_000);
});
