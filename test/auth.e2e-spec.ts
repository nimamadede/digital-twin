import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const PHONE = '13900009876';
const PASSWORD = 'TestPass1';
const NICKNAME = 'AuthE2EUser';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let refreshToken: string;

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

  afterAll(async () => {
    await app?.close();
  });

  describe('POST /auth/sms/send', () => {
    it('should send SMS verification code', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/auth/sms/send`)
        .send({ phone: PHONE, purpose: 'register' })
        .expect(200);
      const body = res.body as { data?: { expireIn?: number } };
      expect(body.data?.expireIn).toBe(300);
    });

    it('should reject invalid phone format', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/auth/sms/send`)
        .send({ phone: '12345', purpose: 'register' })
        .expect(400);
    });

    it('should reject invalid purpose', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/auth/sms/send`)
        .send({ phone: PHONE, purpose: 'invalid' })
        .expect(400);
    });
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/auth/sms/send`)
        .send({ phone: PHONE, purpose: 'register' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`${BASE}/auth/register`)
        .send({ phone: PHONE, password: PASSWORD, nickname: NICKNAME, verifyCode: '123456' });

      if (res.status === 409) return; // already exists
      expect(res.status).toBe(201);
      const body = res.body as { data?: { userId?: string; nickname?: string; phone?: string } };
      expect(body.data?.userId).toBeDefined();
      expect(body.data?.nickname).toBe(NICKNAME);
      expect(body.data?.phone).toMatch(/^\d{3}\*{4}\d{4}$/);
    });

    it('should reject wrong verify code', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/auth/sms/send`)
        .send({ phone: '13800005555', purpose: 'register' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`${BASE}/auth/register`)
        .send({ phone: '13800005555', password: PASSWORD, nickname: 'Bad', verifyCode: '000000' })
        .expect(400);
    });

    it('should reject weak password', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/auth/register`)
        .send({ phone: PHONE, password: '123', nickname: NICKNAME, verifyCode: '123456' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/auth/login`)
        .send({ phone: PHONE, password: PASSWORD })
        .expect(200);

      const body = res.body as {
        data?: { accessToken?: string; refreshToken?: string; expiresIn?: number; user?: { nickname?: string; phone?: string } };
      };
      expect(body.data?.accessToken).toBeDefined();
      expect(body.data?.refreshToken).toBeDefined();
      expect(body.data?.expiresIn).toBe(900);
      expect(body.data?.user?.nickname).toBe(NICKNAME);
      accessToken = body.data!.accessToken!;
      refreshToken = body.data!.refreshToken!;
    });

    it('should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/auth/login`)
        .send({ phone: PHONE, password: 'WrongPass1' })
        .expect(401);
    });

    it('should reject non-existent phone', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/auth/login`)
        .send({ phone: '13700000000', password: PASSWORD })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as { nickname?: string; status?: string; settings?: { autoReply?: boolean } };
      expect(body.nickname).toBe(NICKNAME);
      expect(body.status).toBe('active');
      expect(body.settings?.autoReply).toBeDefined();
    });

    it('should reject without token', async () => {
      await request(app.getHttpServer()).get(`${BASE}/auth/me`).expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/auth/me`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should issue new token pair', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/auth/refresh`)
        .send({ refreshToken })
        .expect(200);

      const body = res.body as { data?: { accessToken?: string; refreshToken?: string; expiresIn?: number } };
      expect(body.data?.accessToken).toBeDefined();
      expect(body.data?.refreshToken).toBeDefined();
      expect(body.data?.expiresIn).toBe(900);
      accessToken = body.data!.accessToken!;
      refreshToken = body.data!.refreshToken!;
    });

    it('should reject reuse of consumed refresh token', async () => {
      const oldRefresh = refreshToken;
      const res = await request(app.getHttpServer())
        .post(`${BASE}/auth/refresh`)
        .send({ refreshToken: oldRefresh })
        .expect(200);

      const body = res.body as { data?: { accessToken?: string; refreshToken?: string } };
      accessToken = body.data!.accessToken!;
      refreshToken = body.data!.refreshToken!;

      await request(app.getHttpServer())
        .post(`${BASE}/auth/refresh`)
        .send({ refreshToken: oldRefresh })
        .expect(401);
    });
  });

  describe('PUT /auth/password', () => {
    const newPassword = 'NewPass1x';

    it('should change password', async () => {
      await request(app.getHttpServer())
        .put(`${BASE}/auth/password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ oldPassword: PASSWORD, newPassword })
        .expect(200);
    });

    it('should login with new password', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/auth/login`)
        .send({ phone: PHONE, password: newPassword })
        .expect(200);

      const body = res.body as { data?: { accessToken?: string; refreshToken?: string } };
      accessToken = body.data!.accessToken!;
      refreshToken = body.data!.refreshToken!;
    });

    it('should reject old password', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/auth/login`)
        .send({ phone: PHONE, password: PASSWORD })
        .expect(401);
    });

    it('should restore original password', async () => {
      await request(app.getHttpServer())
        .put(`${BASE}/auth/password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ oldPassword: newPassword, newPassword: PASSWORD })
        .expect(200);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout and invalidate refresh token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post(`${BASE}/auth/login`)
        .send({ phone: PHONE, password: PASSWORD })
        .expect(200);

      const body = loginRes.body as { data?: { accessToken?: string; refreshToken?: string } };
      const logoutAccess = body.data!.accessToken!;
      const logoutRefresh = body.data!.refreshToken!;

      await request(app.getHttpServer())
        .post(`${BASE}/auth/logout`)
        .set('Authorization', `Bearer ${logoutAccess}`)
        .send({ refreshToken: logoutRefresh })
        .expect(200);

      await request(app.getHttpServer())
        .post(`${BASE}/auth/refresh`)
        .send({ refreshToken: logoutRefresh })
        .expect(401);
    });

    it('should reject logout without auth', async () => {
      await request(app.getHttpServer()).post(`${BASE}/auth/logout`).expect(401);
    });
  });
});