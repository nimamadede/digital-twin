import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const PHONE = '13900005555';
const PASSWORD = 'TestPass1';
const NICKNAME = 'PlatformE2EUser';

describe('Platform (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let authId: string;
  let platformAuthId: string;

  beforeAll(async () => {
    jest.setTimeout(30000);
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
  }, 25000);

  beforeAll(async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/sms/send`)
      .send({ phone: PHONE, purpose: 'register' })
      .expect(200);

    const regRes = await request(app.getHttpServer())
      .post(`${BASE}/auth/register`)
      .send({ phone: PHONE, password: PASSWORD, nickname: NICKNAME, verifyCode: '123456' });
    if (regRes.status !== 409) expect(regRes.status).toBe(201);

    const loginRes = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ phone: PHONE, password: PASSWORD })
      .expect(200);

    const body = loginRes.body as { data?: { accessToken?: string } };
    accessToken = body.data!.accessToken!;
    expect(accessToken).toBeDefined();
  }, 15000);

  afterAll(async () => {
    await app?.close();
  });

  const auth = (method: 'get' | 'post' | 'put' | 'delete') =>
    (url: string) => request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${accessToken}`);

  describe('GET /platforms', () => {
    it('should return empty list initially', async () => {
      const res = await auth('get')(`${BASE}/platforms`).expect(200);

      const data = res.body as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('POST /platforms/authorize', () => {
    it('should start WeChat QR authorization', async () => {
      const res = await auth('post')(`${BASE}/platforms/authorize`)
        .send({ platform: 'wechat', authType: 'qrcode' })
        .expect(200);

      const data = res.body as { authId?: string; qrcodeUrl?: string; status?: string; expiresIn?: number };
      expect(data.authId).toBeDefined();
      expect(data.status).toBe('waiting_scan');
      expect(data.expiresIn).toBeGreaterThan(0);
      authId = data.authId!;
    });

    it('should reject invalid platform', async () => {
      await auth('post')(`${BASE}/platforms/authorize`)
        .send({ platform: 'invalid', authType: 'qrcode' })
        .expect(400);
    });
  });

  describe('GET /platforms/authorize/:authId/status', () => {
    it('should return auth status', async () => {
      const res = await auth('get')(`${BASE}/platforms/authorize/${authId}/status`)
        .expect(200);

      const data = res.body as { authId?: string; status?: string };
      expect(data.authId).toBe(authId);
      expect(['waiting_scan', 'scanned', 'confirmed']).toContain(data.status);
    });

    it('should eventually confirm (mock auto-confirm)', async () => {
      // Wait for mock to auto-confirm
      await new Promise((r) => setTimeout(r, 2500));

      const res = await auth('get')(`${BASE}/platforms/authorize/${authId}/status`)
        .expect(200);

      const data = res.body as { authId?: string; status?: string; platformAuthId?: string };
      expect(data.status).toBe('confirmed');
      expect(data.platformAuthId).toBeDefined();
      platformAuthId = data.platformAuthId!;
    });
  });

  describe('GET /platforms (after connect)', () => {
    it('should list connected platform', async () => {
      const res = await auth('get')(`${BASE}/platforms`).expect(200);

      const data = res.body as Array<{ id: string; platform: string; status: string }>;
      expect(data.length).toBeGreaterThanOrEqual(1);
      const wechat = data.find((p) => p.id === platformAuthId);
      expect(wechat?.platform).toBe('wechat');
      expect(wechat?.status).toBe('connected');
    });
  });

  describe('PUT /platforms/:platformAuthId', () => {
    it('should update platform config', async () => {
      await auth('put')(`${BASE}/platforms/${platformAuthId}`)
        .send({ autoListen: true, messageTypes: ['text', 'image'] })
        .expect(200);
    });
  });

  describe('Listener lifecycle', () => {
    it('should start listener', async () => {
      await auth('post')(`${BASE}/platforms/${platformAuthId}/listener/start`)
        .expect(204);
    });

    it('should get listener state (listening)', async () => {
      const res = await auth('get')(`${BASE}/platforms/${platformAuthId}/listener`)
        .expect(200);

      const data = res.body as { isListening?: boolean };
      expect(data.isListening).toBe(true);
    });

    it('should stop listener', async () => {
      await auth('post')(`${BASE}/platforms/${platformAuthId}/listener/stop`)
        .expect(204);
    });

    it('should get listener state (stopped)', async () => {
      const res = await auth('get')(`${BASE}/platforms/${platformAuthId}/listener`)
        .expect(200);

      const data = res.body as { isListening?: boolean };
      expect(data.isListening).toBe(false);
    });
  });

  describe('DELETE /platforms/:platformAuthId', () => {
    it('should disconnect platform', async () => {
      await auth('delete')(`${BASE}/platforms/${platformAuthId}`)
        .expect(204);
    });

    it('should return empty list after disconnect', async () => {
      const res = await auth('get')(`${BASE}/platforms`).expect(200);

      const data = res.body as unknown[];
      expect(data.length).toBe(0);
    });
  });
});
