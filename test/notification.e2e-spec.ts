import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const PHONE = '13900006666';
const PASSWORD = 'TestPass1';
const NICKNAME = 'NotifE2EUser';

describe('Notification (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let notificationId: string;

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

  const auth = (method: 'get' | 'post' | 'put' | 'delete' | 'patch') =>
    (url: string) => request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${accessToken}`);

  describe('POST /notifications', () => {
    it('should create a notification', async () => {
      const res = await auth('post')(`${BASE}/notifications`)
        .send({
          type: 'reply_pending',
          title: '新回复待审核',
          content: '张三发来消息，已生成回复候选',
          actionUrl: '/replies/pending',
        })
        .expect(201);

      const data = res.body as { id?: string; type?: string; title?: string; isRead?: boolean };
      expect(data.id).toBeDefined();
      expect(data.type).toBe('reply_pending');
      expect(data.title).toBe('新回复待审核');
      expect(data.isRead).toBe(false);
      notificationId = data.id!;
    });

    it('should create a second notification', async () => {
      const res = await auth('post')(`${BASE}/notifications`)
        .send({
          type: 'system',
          title: '系统通知',
          content: '欢迎使用数字分身',
        })
        .expect(201);

      const data = res.body as { id?: string };
      expect(data.id).toBeDefined();
    });
  });

  describe('GET /notifications', () => {
    it('should list notifications', async () => {
      const res = await auth('get')(`${BASE}/notifications`).expect(200);

      const data = res.body as { items?: unknown[]; total?: number };
      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter by type', async () => {
      const res = await auth('get')(`${BASE}/notifications?type=system`).expect(200);

      const data = res.body as { items?: Array<{ type?: string }>; total?: number };
      expect(data.total).toBeGreaterThanOrEqual(1);
      data.items?.forEach((item) => {
        expect(item.type).toBe('system');
      });
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('should return unread count', async () => {
      const res = await auth('get')(`${BASE}/notifications/unread-count`).expect(200);

      const data = res.body as { count?: number };
      expect(data.count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /notifications/:id', () => {
    it('should return notification detail', async () => {
      const res = await auth('get')(`${BASE}/notifications/${notificationId}`).expect(200);

      const data = res.body as { id?: string; title?: string; isRead?: boolean };
      expect(data.id).toBe(notificationId);
      expect(data.title).toBe('新回复待审核');
      expect(data.isRead).toBe(false);
    });

    it('should return 404 for non-existent notification', async () => {
      await auth('get')(`${BASE}/notifications/00000000-0000-0000-0000-000000000000`).expect(404);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const res = await auth('patch')(`${BASE}/notifications/${notificationId}/read`)
        .send({})
        .expect(200);

      const data = res.body as { isRead?: boolean };
      expect(data.isRead).toBe(true);
    });
  });

  describe('GET /notifications/unread-count (after mark read)', () => {
    it('should reflect decreased unread count', async () => {
      const res = await auth('get')(`${BASE}/notifications/unread-count`).expect(200);

      const data = res.body as { count?: number };
      expect(data.count).toBeGreaterThanOrEqual(1); // at least the system one
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('should mark all as read', async () => {
      const res = await auth('patch')(`${BASE}/notifications/read-all`)
        .send({})
        .expect(200);

      const data = res.body as { updated?: number };
      expect(data.updated).toBeGreaterThanOrEqual(1);
    });

    it('should have zero unread after mark all', async () => {
      const res = await auth('get')(`${BASE}/notifications/unread-count`).expect(200);

      const data = res.body as { count?: number };
      expect(data.count).toBe(0);
    });
  });

  describe('GET /notifications (filter isRead)', () => {
    it('should filter unread notifications', async () => {
      const res = await auth('get')(`${BASE}/notifications?isRead=false`).expect(200);

      const data = res.body as { items?: unknown[]; total?: number };
      expect(data.total).toBe(0);
    });
  });
});
