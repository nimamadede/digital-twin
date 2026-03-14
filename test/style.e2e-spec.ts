import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * E2E: Upload chat file → task pending→completed → profile queryable.
 * Requires: PostgreSQL, Redis, MinIO (e.g. docker-compose up -d). Qdrant optional.
 * Run: npm run test:e2e -- test/style.e2e-spec.ts --forceExit
 */
describe('Style (e2e) - upload then task completed, profile queryable', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let taskId: string;
  let profileId: string;

  const baseUrl = '/api/v1';
  const testPhone = '13900139001';
  const testPassword = 'TestPass123!';
  const testNickname = 'e2e-style-user';

  const chatContent = [
    '你好呀',
    '哈哈好的，那我们明天见吧',
    '嗯嗯可以的',
  ].join('\n');

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

  it('1. register user (or skip if exists)', async () => {
    await request(app.getHttpServer())
      .post(`${baseUrl}/auth/sms/send`)
      .send({ phone: testPhone, purpose: 'register' })
      .expect(200);

    const registerRes = await request(app.getHttpServer())
      .post(`${baseUrl}/auth/register`)
      .send({
        phone: testPhone,
        password: testPassword,
        nickname: testNickname,
        verifyCode: '123456',
      });

    if (registerRes.status === 409) return;
    if (registerRes.status === 400 && registerRes.body?.error === 'INVALID_VERIFY_CODE') {
      throw new Error('Run with NODE_ENV=development so mock SMS code 123456 is used');
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

  it('3. upload chat file and get taskId (status pending)', async () => {
    const res = await request(app.getHttpServer())
      .post(`${baseUrl}/styles/upload`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('platform', 'wechat')
      .field('description', 'e2e chat export')
      .attach('file', Buffer.from(chatContent, 'utf-8'), 'wechat_export_2026.txt')
      .expect(201);

    const wrap = res.body.data ?? res.body;
    const data = wrap.data ?? wrap;
    expect(data).toMatchObject({
      fileId: expect.any(String),
      fileName: expect.any(String),
      fileSize: expect.any(Number),
      taskId: expect.any(String),
      status: 'pending',
    });
    taskId = data.taskId;
    expect(taskId).toBeDefined();
  }, 15_000);

  it('4. poll task until status completed', async () => {
    expect(taskId).toBeDefined();
    const maxWaitMs = 30_000;
    const intervalMs = 500;
    let status: string = 'pending';
    let elapsed = 0;

    while (elapsed < maxWaitMs) {
      const res = await request(app.getHttpServer())
        .get(`${baseUrl}/styles/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const wrap = res.body.data ?? res.body;
      const task = wrap.data ?? wrap;
      status = task.status;
      if (status === 'completed' || status === 'failed') break;
      await new Promise((r) => setTimeout(r, intervalMs));
      elapsed += intervalMs;
    }

    if (status !== 'completed') {
      const lastRes = await request(app.getHttpServer())
        .get(`${baseUrl}/styles/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const lastWrap = lastRes.body.data ?? lastRes.body;
      const task = lastWrap.data ?? lastWrap;
      throw new Error(
        `Task ended with status ${task.status}, error: ${task.errorMessage ?? 'none'}. ` +
          'Ensure MinIO and Redis are running (e.g. docker-compose up -d).',
      );
    }
    expect(status).toBe('completed');
  }, 35_000);

  it('5. list profiles and get profileId', async () => {
    const res = await request(app.getHttpServer())
      .get(`${baseUrl}/styles/profiles`)
      .query({ page: 1, pageSize: 20 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const wrap = res.body.data ?? res.body;
    const payload = wrap.data ?? wrap;
    expect(payload).toHaveProperty('items');
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBeGreaterThanOrEqual(1);

    const active = payload.items.find((p: { status: string }) => p.status === 'active');
    expect(active).toBeDefined();
    expect(active).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      traits: expect.any(Object),
      sampleCount: expect.any(Number),
      status: 'active',
    });
    profileId = active.id;
    expect(profileId).toBeDefined();
  }, 10_000);

  it('6. get profile detail (traits and samples)', async () => {
    expect(profileId).toBeDefined();
    const res = await request(app.getHttpServer())
      .get(`${baseUrl}/styles/profiles/${profileId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const wrap = res.body.data ?? res.body;
    const data = wrap.data ?? wrap;
    expect(data).toMatchObject({
      id: profileId,
      name: expect.any(String),
      traits: expect.any(Object),
      sampleCount: expect.any(Number),
      status: 'active',
      samples: expect.any(Array),
    });
    expect(data.sampleCount).toBeGreaterThan(0);
    expect(data.samples.length).toBeGreaterThan(0);
    expect(data.traits).toHaveProperty('formality');
    expect(data.traits).toHaveProperty('humor');
    expect(data.samples[0]).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      platform: 'wechat',
    });
  }, 10_000);
});
