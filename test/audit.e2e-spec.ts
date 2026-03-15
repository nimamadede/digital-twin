import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const PHONE = '13900007777';
const PASSWORD = 'TestPass1';
const NICKNAME = 'AuditE2EUser';

describe('Audit (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

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

  // Generate audit log entries by performing mutating actions
  it('should create audit entries via scene creation', async () => {
    await auth('post')(`${BASE}/scenes`)
      .send({
        name: '审计测试场景',
        description: '用于生成审计日志',
        replyStyle: 'formal',
        autoReply: false,
        rules: {},
      })
      .expect(201);

    // Small delay for async audit interceptor to write
    await new Promise((r) => setTimeout(r, 500));
  });

  it('should create another audit entry via password change', async () => {
    await auth('put')(`${BASE}/auth/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: PASSWORD, newPassword: 'NewAudit1' })
      .expect(200);

    // Login with new password
    const loginRes = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ phone: PHONE, password: 'NewAudit1' })
      .expect(200);

    const body = loginRes.body as { data?: { accessToken?: string } };
    accessToken = body.data!.accessToken!;

    // Restore password
    await auth('put')(`${BASE}/auth/password`)
      .send({ oldPassword: 'NewAudit1', newPassword: PASSWORD })
      .expect(200);

    const restoreLogin = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ phone: PHONE, password: PASSWORD })
      .expect(200);

    const restoreBody = restoreLogin.body as { data?: { accessToken?: string } };
    accessToken = restoreBody.data!.accessToken!;

    await new Promise((r) => setTimeout(r, 500));
  });

  describe('GET /audit-logs', () => {
    it('should return paginated audit logs', async () => {
      const res = await auth('get')(`${BASE}/audit-logs`).expect(200);

      const data = res.body as { items?: Array<{ id: string; action: string }>; total?: number; page?: number; pageSize?: number };
      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(data.page).toBe(1);
    });

    it('should filter by resourceType', async () => {
      const res = await auth('get')(`${BASE}/audit-logs?resourceType=scenes`).expect(200);

      const data = res.body as { items?: Array<{ resourceType?: string }>; total?: number };
      data.items?.forEach((item) => {
        expect(item.resourceType).toBe('scenes');
      });
    });
  });

  describe('GET /audit-logs/:id', () => {
    it('should return audit log detail', async () => {
      // First get a log ID
      const listRes = await auth('get')(`${BASE}/audit-logs`).expect(200);
      const list = listRes.body as { items?: Array<{ id: string }> };

      if (list.items && list.items.length > 0) {
        const logId = list.items[0].id;
        const res = await auth('get')(`${BASE}/audit-logs/${logId}`).expect(200);

        const data = res.body as { id?: string; action?: string; userId?: string };
        expect(data.id).toBe(logId);
        expect(data.action).toBeDefined();
        expect(data.userId).toBeDefined();
      }
    });

    it('should return 404 for non-existent log', async () => {
      await auth('get')(`${BASE}/audit-logs/00000000-0000-0000-0000-000000000000`).expect(404);
    });
  });
});
