import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const PHONE = '13900002222';
const PASSWORD = 'TestPass1';
const NICKNAME = 'ReplyE2EUser';

describe('Reply (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let contactId: string;
  let replyId: string;

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
    // Register + Login
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

  // Create a contact for reply generation
  it('should create contact via inbound message', async () => {
    const res = await auth('post')(`${BASE}/router/inbound`)
      .send({
        platform: 'wechat',
        platformContactId: 'wxid_reply_test',
        nickname: '回复测试联系人',
        content: '你好',
        msgType: 'text',
      })
      .expect(200);

    const data = res.body as { contactId?: string };
    contactId = data.contactId!;
    expect(contactId).toBeDefined();
  });

  describe('POST /replies/generate', () => {
    it('should reject when contactId is missing', async () => {
      await auth('post')(`${BASE}/replies/generate`)
        .send({ incomingMessage: '你好', count: 2 })
        .expect(400);
    });

    it('should generate reply candidates', async () => {
      const res = await auth('post')(`${BASE}/replies/generate`)
        .send({
          incomingMessage: '明天下午有时间吗？',
          contactId,
          count: 2,
        })
        .expect(201);

      const data = res.body as {
        replyId?: string;
        candidates?: Array<{ content: string; confidence: number }>;
      };
      expect(data.replyId).toBeDefined();
      expect(data.candidates).toBeDefined();
      expect(data.candidates!.length).toBeGreaterThanOrEqual(1);
      replyId = data.replyId!;
    });
  });

  describe('GET /replies/pending', () => {
    it('should list pending replies', async () => {
      const res = await auth('get')(`${BASE}/replies/pending`).expect(200);

      const data = res.body as { items?: unknown[]; total?: number };
      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /replies/:replyId/review', () => {
    it('should reject invalid action', async () => {
      await auth('post')(`${BASE}/replies/${replyId}/review`)
        .send({ action: 'invalid' })
        .expect(400);
    });

    it('should approve reply with selectedIndex', async () => {
      const res = await auth('post')(`${BASE}/replies/${replyId}/review`)
        .send({ action: 'approve', selectedIndex: 0 })
        .expect(200);

      const body = res.body as { data?: { status?: string; sentContent?: string } };
      expect(body.data?.status).toBe('sent');
      expect(body.data?.sentContent).toBeDefined();
    });

    it('should reject already reviewed reply', async () => {
      await auth('post')(`${BASE}/replies/${replyId}/review`)
        .send({ action: 'approve', selectedIndex: 0 })
        .expect(400);
    });
  });

  describe('POST /replies/:replyId/feedback', () => {
    it('should submit feedback', async () => {
      await auth('post')(`${BASE}/replies/${replyId}/feedback`)
        .send({ rating: 4, feedback: 'perfect', comment: '很好' })
        .expect(200);
    });

    it('should reject invalid rating', async () => {
      await auth('post')(`${BASE}/replies/${replyId}/feedback`)
        .send({ rating: 0 })
        .expect(400);
    });
  });

  describe('review reject and edit flows', () => {
    let rejectReplyId: string;
    let editReplyId: string;

    it('should generate and reject a reply', async () => {
      const genRes = await auth('post')(`${BASE}/replies/generate`)
        .send({ incomingMessage: '今晚吃什么', contactId, count: 1 })
        .expect(201);

      const genBody = genRes.body as { replyId?: string };
      rejectReplyId = genBody.replyId!;

      const res = await auth('post')(`${BASE}/replies/${rejectReplyId}/review`)
        .send({ action: 'reject' })
        .expect(200);

      const body = res.body as { data?: { status?: string } };
      expect(body.data?.status).toBe('rejected');
    });

    it('should generate and edit a reply', async () => {
      const genRes = await auth('post')(`${BASE}/replies/generate`)
        .send({ incomingMessage: '周末有空吗', contactId, count: 1 })
        .expect(201);

      const genBody = genRes.body as { replyId?: string };
      editReplyId = genBody.replyId!;

      const res = await auth('post')(`${BASE}/replies/${editReplyId}/review`)
        .send({ action: 'edit', editedContent: '周末看情况吧' })
        .expect(200);

      const body = res.body as { data?: { status?: string; sentContent?: string } };
      expect(body.data?.status).toBe('edited');
      expect(body.data?.sentContent).toBe('周末看情况吧');
    });
  });

  describe('GET /replies/history', () => {
    it('should return reply history', async () => {
      const res = await auth('get')(`${BASE}/replies/history`).expect(200);

      const data = res.body as { items?: unknown[]; total?: number; page?: number; pageSize?: number };
      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(data.page).toBe(1);
    });

    it('should filter by status', async () => {
      const res = await auth('get')(`${BASE}/replies/history?status=sent`).expect(200);

      const data = res.body as { items?: Array<{ status?: string }> };
      data.items?.forEach((item) => {
        expect(item.status).toBe('sent');
      });
    });
  });
});
