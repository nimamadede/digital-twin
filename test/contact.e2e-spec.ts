import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const PHONE = '13900004444';
const PASSWORD = 'TestPass1';
const NICKNAME = 'ContactE2EUser';

describe('Contact (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
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

  // Create a contact via inbound message first
  it('should create contact via inbound message', async () => {
    const res = await auth('post')(`${BASE}/router/inbound`)
      .send({
        platform: 'wechat',
        platformContactId: 'wxid_contact_e2e',
        nickname: '联系人测试',
        content: '创建联系人',
        msgType: 'text',
      })
      .expect(200);

    const data = res.body as { contactId?: string };
    contactId = data.contactId!;
    expect(contactId).toBeDefined();
  });

  describe('GET /contacts', () => {
    it('should list contacts with pagination', async () => {
      const res = await auth('get')(`${BASE}/contacts`).expect(200);

      const data = res.body as { items?: unknown[]; total?: number; page?: number; pageSize?: number };
      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(data.page).toBe(1);
    });

    it('should filter by platform', async () => {
      const res = await auth('get')(`${BASE}/contacts?platform=wechat`).expect(200);

      const data = res.body as { items?: Array<{ platform?: string }> };
      data.items?.forEach((item) => {
        expect(item.platform).toBe('wechat');
      });
    });

    it('should filter by keyword', async () => {
      const res = await auth('get')(`${BASE}/contacts?keyword=联系人`).expect(200);

      const data = res.body as { items?: unknown[]; total?: number };
      expect(data.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /contacts/:contactId', () => {
    it('should return contact detail', async () => {
      const res = await auth('get')(`${BASE}/contacts/${contactId}`).expect(200);

      const data = res.body as { id?: string; nickname?: string; platform?: string };
      expect(data.id).toBe(contactId);
      expect(data.nickname).toBe('联系人测试');
      expect(data.platform).toBe('wechat');
    });

    it('should return 404 for non-existent contact', async () => {
      await auth('get')(`${BASE}/contacts/00000000-0000-0000-0000-000000000000`).expect(404);
    });
  });

  describe('PUT /contacts/:contactId', () => {
    it('should update contact level and remark', async () => {
      const res = await auth('put')(`${BASE}/contacts/${contactId}`)
        .send({ level: 'important', remark: '重要客户', tags: ['VIP', '客户'] })
        .expect(200);

      const data = res.body as { level?: string; remark?: string; tags?: string[] };
      expect(data.level).toBe('important');
      expect(data.remark).toBe('重要客户');
      expect(data.tags).toEqual(['VIP', '客户']);
    });
  });

  describe('POST /contacts/:contactId/whitelist', () => {
    it('should add to whitelist', async () => {
      const res = await auth('post')(`${BASE}/contacts/${contactId}/whitelist`).expect(200);

      const data = res.body as { isWhitelist?: boolean };
      expect(data.isWhitelist).toBe(true);
    });
  });

  describe('DELETE /contacts/:contactId/whitelist', () => {
    it('should remove from whitelist', async () => {
      const res = await auth('delete')(`${BASE}/contacts/${contactId}/whitelist`).expect(200);

      const data = res.body as { isWhitelist?: boolean };
      expect(data.isWhitelist).toBe(false);
    });
  });

  describe('POST /contacts/:contactId/blacklist', () => {
    it('should add to blacklist', async () => {
      const res = await auth('post')(`${BASE}/contacts/${contactId}/blacklist`).expect(200);

      const data = res.body as { isBlacklist?: boolean };
      expect(data.isBlacklist).toBe(true);
    });
  });

  describe('DELETE /contacts/:contactId/blacklist', () => {
    it('should remove from blacklist', async () => {
      const res = await auth('delete')(`${BASE}/contacts/${contactId}/blacklist`).expect(200);

      const data = res.body as { isBlacklist?: boolean };
      expect(data.isBlacklist).toBe(false);
    });
  });

  describe('PUT /contacts/batch', () => {
    it('should batch update contacts', async () => {
      const res = await auth('put')(`${BASE}/contacts/batch`)
        .send({
          contactIds: [contactId],
          updates: { level: 'normal', isWhitelist: true },
        })
        .expect(200);

      const data = res.body as { updated?: number };
      expect(data.updated).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /contacts/import', () => {
    it('should import contacts from CSV', async () => {
      const csv = 'nickname,platformId,remark,level\n导入用户A,wxid_import_a,备注A,normal\n导入用户B,wxid_import_b,,important';

      const res = await auth('post')(`${BASE}/contacts/import`)
        .field('platform', 'wechat')
        .attach('file', Buffer.from(csv), 'contacts.csv')
        .expect(200);

      const body = res.body as { data?: { total?: number; created?: number; skipped?: number } };
      expect(body.data?.total).toBe(2);
      expect(body.data?.created).toBeGreaterThanOrEqual(1);
    });

    it('should import contacts from JSON', async () => {
      const json = JSON.stringify([
        { nickname: 'JSON导入A', platformId: 'wxid_json_a', tags: ['测试'] },
        { nickname: 'JSON导入B', platformId: 'wxid_json_b' },
      ]);

      const res = await auth('post')(`${BASE}/contacts/import`)
        .field('platform', 'wechat')
        .attach('file', Buffer.from(json), 'contacts.json')
        .expect(200);

      const body = res.body as { data?: { total?: number; created?: number } };
      expect(body.data?.total).toBe(2);
      expect(body.data?.created).toBeGreaterThanOrEqual(1);
    });

    it('should skip duplicate contacts on re-import', async () => {
      const csv = 'nickname,platformId\n导入用户A,wxid_import_a';

      const res = await auth('post')(`${BASE}/contacts/import`)
        .field('platform', 'wechat')
        .attach('file', Buffer.from(csv), 'contacts.csv')
        .expect(200);

      const body = res.body as { data?: { skipped?: number } };
      expect(body.data?.skipped).toBeGreaterThanOrEqual(1);
    });

    it('should reject unsupported file type', async () => {
      await auth('post')(`${BASE}/contacts/import`)
        .field('platform', 'wechat')
        .attach('file', Buffer.from('hello'), 'contacts.pdf')
        .expect(400);
    });
  });
});
