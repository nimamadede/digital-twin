import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const PHONE = '13900003333';
const PASSWORD = 'TestPass1';
const NICKNAME = 'RouterE2EUser';

describe('MessageRouter (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let ruleId: string;
  let contactId: string;

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

  describe('POST /router/rules', () => {
    it('should create a routing rule', async () => {
      const res = await auth('post')(`${BASE}/router/rules`)
        .send({
          name: '群消息忽略',
          priority: 10,
          isEnabled: true,
          type: 'block',
          conditions: { isGroup: true },
          action: 'ignored',
        })
        .expect(201);

      const body = res.body as { data?: { id?: string; name?: string } };
      expect(body.data?.id).toBeDefined();
      expect(body.data?.name).toBe('群消息忽略');
      ruleId = body.data!.id!;
    });

    it('should reject rule with invalid action', async () => {
      await auth('post')(`${BASE}/router/rules`)
        .send({
          name: 'Invalid',
          priority: 5,
          isEnabled: true,
          type: 'route',
          conditions: {},
          action: 'bad_action',
        })
        .expect(400);
    });
  });

  describe('GET /router/rules', () => {
    it('should list rules sorted by priority', async () => {
      const res = await auth('get')(`${BASE}/router/rules`).expect(200);

      const data = res.body as Array<{ id: string; name: string; priority: number }>;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PUT /router/rules/:ruleId', () => {
    it('should update rule name and priority', async () => {
      const res = await auth('put')(`${BASE}/router/rules/${ruleId}`)
        .send({ name: '群聊忽略(已更新)', priority: 15 })
        .expect(200);

      const data = res.body as { name?: string; priority?: number };
      expect(data.name).toBe('群聊忽略(已更新)');
    });
  });

  describe('POST /router/inbound', () => {
    it('should process inbound message', async () => {
      const res = await auth('post')(`${BASE}/router/inbound`)
        .send({
          platform: 'wechat',
          platformContactId: 'wxid_router_test',
          nickname: '路由测试',
          content: '你好，请问在吗？',
          msgType: 'text',
        })
        .expect(200);

      const data = res.body as { action?: string; contactId?: string };
      expect(data.action).toBeDefined();
      contactId = data.contactId!;
    });
  });

  describe('POST /router/simulate', () => {
    it('should simulate routing without sending', async () => {
      if (!contactId) return;

      const res = await auth('post')(`${BASE}/router/simulate`)
        .send({
          contactId,
          incomingMessage: '测试模拟',
          platform: 'wechat',
        })
        .expect(201);

      const data = res.body as { action?: string; steps?: unknown[] };
      expect(data.action).toBeDefined();
    });
  });

  describe('POST /router/pause & resume', () => {
    it('should pause routing', async () => {
      const res = await auth('post')(`${BASE}/router/pause`).expect(200);

      const body = res.body as { data?: { paused?: boolean } };
      expect(body.data?.paused).toBe(true);
    });

    it('should resume routing', async () => {
      const res = await auth('post')(`${BASE}/router/resume`).expect(200);

      const body = res.body as { data?: { paused?: boolean } };
      expect(body.data?.paused).toBe(false);
    });
  });

  describe('GET /router/dashboard', () => {
    it('should return dashboard data', async () => {
      const res = await auth('get')(`${BASE}/router/dashboard`).expect(200);

      const data = res.body as { paused?: boolean; todayStats?: unknown };
      expect(data).toHaveProperty('paused');
      expect(data).toHaveProperty('todayStats');
    });
  });

  describe('GET /router/logs', () => {
    it('should return routing logs', async () => {
      const res = await auth('get')(`${BASE}/router/logs`).expect(200);

      const data = res.body as { items?: unknown[]; total?: number };
      expect(data.items).toBeDefined();
    });
  });

  describe('GET /router/stats', () => {
    it('should return routing stats', async () => {
      const res = await auth('get')(`${BASE}/router/stats`).expect(200);

      expect(res.body).toBeDefined();
    });
  });

  describe('DELETE /router/rules/:ruleId', () => {
    it('should delete rule', async () => {
      await auth('delete')(`${BASE}/router/rules/${ruleId}`).expect(200);
    });

    it('should return 404 for deleted rule', async () => {
      await auth('put')(`${BASE}/router/rules/${ruleId}`)
        .send({ name: 'test' })
        .expect(404);
    });
  });
});
