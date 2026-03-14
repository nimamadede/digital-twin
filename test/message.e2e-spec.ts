import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Message } from '../src/message/entities/message.entity';
import { Contact } from '../src/contact/entities/contact.entity';

/**
 * E2E: Message list pagination and stats.
 * Requires: PostgreSQL, Redis (e.g. docker-compose up -d).
 * Run: npm run test:e2e -- test/message.e2e-spec.ts
 */
describe('Message (e2e) - list pagination and stats', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let userId: string;
  let contactId: string;

  const BASE = '/api/v1';
  const PHONE = '13900009999';
  const PASSWORD = 'TestPass1';
  const NICKNAME = 'MessageE2EUser';

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

  const auth = (method: 'get' | 'post') => (url: string) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${accessToken}`);

  it('1. register or login and get accessToken', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/auth/sms/send`)
      .send({ phone: PHONE, purpose: 'register' })
      .expect(200);

    const registerRes = await request(app.getHttpServer())
      .post(`${BASE}/auth/register`)
      .send({
        phone: PHONE,
        password: PASSWORD,
        nickname: NICKNAME,
        verifyCode: '123456',
      });

    if (registerRes.status !== 201 && registerRes.status !== 409) {
      throw new Error(
        `Register failed: ${registerRes.status} ${JSON.stringify(registerRes.body)}`,
      );
    }

    const loginRes = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ phone: PHONE, password: PASSWORD })
      .expect(200);

    const raw = loginRes.body?.data ?? loginRes.body;
    const data = raw?.data ?? raw;
    accessToken = data?.accessToken ?? raw?.accessToken;
    userId = data?.user?.id ?? data?.id ?? raw?.user?.id;
    expect(accessToken).toBeDefined();
  }, 15000);

  it('2. get current user id (from me if not in login)', async () => {
    if (userId) return;
    const res = await auth('get')(`${BASE}/auth/me`).expect(200);
    const meData = res.body?.data ?? res.body;
    userId = meData.id ?? meData.userId;
    expect(userId).toBeDefined();
  }, 5000);

  it('3. seed one contact and messages for stats', async () => {
    expect(userId).toBeDefined();
    const ds = app.get(DataSource);
    const contactRepo = ds.getRepository(Contact);
    const messageRepo = ds.getRepository(Message);

    const existingContact = await contactRepo.findOne({
      where: { userId, platform: 'wechat', platformId: 'e2e_msg_contact' },
    });
    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const contact = contactRepo.create({
        userId,
        platformId: 'e2e_msg_contact',
        platform: 'wechat',
        nickname: 'E2E联系人',
        level: 'normal',
        isWhitelist: false,
        isBlacklist: false,
        tags: [],
      });
      const saved = await contactRepo.save(contact);
      contactId = saved.id;
    }

    const existingCount = await messageRepo.count({ where: { userId } });
    if (existingCount >= 5) {
      return;
    }
    const toInsert = [
      { direction: 'incoming', content: '第一条消息', isAiGenerated: false },
      { direction: 'outgoing', content: '第二条回复', isAiGenerated: true },
      { direction: 'incoming', content: '第三条', isAiGenerated: false },
      { direction: 'outgoing', content: '第四条', isAiGenerated: false },
      { direction: 'incoming', content: '第五条', isAiGenerated: false },
    ].map((m) =>
      messageRepo.create({
        userId,
        contactId,
        direction: m.direction,
        content: m.content,
        msgType: 'text',
        platform: 'wechat',
        isAiGenerated: m.isAiGenerated,
      }),
    );
    await messageRepo.save(toInsert);
  }, 10000);

  it('4. GET /messages - list pagination shape and rules', async () => {
    const res = await auth('get')(
      `${BASE}/messages?page=1&pageSize=10`,
    ).expect(200);

    const data = res.body?.data ?? res.body;
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
    expect(data).toHaveProperty('total');
    expect(typeof data.total).toBe('number');
    expect(data.total).toBeGreaterThanOrEqual(0);
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('pageSize');
    expect(data).toHaveProperty('totalPages');
    expect(typeof data.page).toBe('number');
    expect(typeof data.pageSize).toBe('number');
    expect(typeof data.totalPages).toBe('number');

    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(10);
    expect(data.items.length).toBeLessThanOrEqual(10);

    const expectedTotalPages = data.total === 0 ? 0 : Math.ceil(data.total / data.pageSize);
    expect(data.totalPages).toBe(expectedTotalPages);

    if (data.items.length > 0) {
      const first = data.items[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('contactId');
      expect(first).toHaveProperty('contactNickname');
      expect(first).toHaveProperty('direction');
      expect(first).toHaveProperty('content');
      expect(first).toHaveProperty('msgType');
      expect(first).toHaveProperty('platform');
      expect(first).toHaveProperty('isAiGenerated');
      expect(first).toHaveProperty('replyRecordId');
      expect(first).toHaveProperty('createdAt');
    }
  }, 10000);

  it('5. GET /messages - second page when enough data', async () => {
    const pageSize = 2;
    const res = await auth('get')(
      `${BASE}/messages?page=1&pageSize=${pageSize}`,
    ).expect(200);
    const data = res.body?.data ?? res.body;
    const total = data.total as number;

    if (total < 3) {
      return;
    }
    const page2Res = await auth('get')(
      `${BASE}/messages?page=2&pageSize=${pageSize}`,
    ).expect(200);
    const page2 = page2Res.body?.data ?? page2Res.body;
    expect(page2.page).toBe(2);
    expect(page2.pageSize).toBe(pageSize);
    expect(page2.items.length).toBeLessThanOrEqual(pageSize);
    expect(page2.total).toBe(total);
    expect(page2.totalPages).toBe(Math.ceil(total / pageSize));
  }, 10000);

  it('6. GET /messages/stats - structure and consistency', async () => {
    const res = await auth('get')(
      `${BASE}/messages/stats?period=week`,
    ).expect(200);

    const data = res.body?.data ?? res.body;
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('timeline');
    expect(data).toHaveProperty('topContacts');
    expect(Array.isArray(data.timeline)).toBe(true);
    expect(Array.isArray(data.topContacts)).toBe(true);

    const s = data.summary;
    expect(s).toHaveProperty('totalMessages');
    expect(s).toHaveProperty('incomingMessages');
    expect(s).toHaveProperty('outgoingMessages');
    expect(s).toHaveProperty('aiGeneratedReplies');
    expect(s).toHaveProperty('manualReplies');
    expect(s).toHaveProperty('autoApproveRate');
    expect(s).toHaveProperty('avgResponseTime');
    expect(s).toHaveProperty('feedbackAvgRating');

    expect(typeof s.totalMessages).toBe('number');
    expect(typeof s.incomingMessages).toBe('number');
    expect(typeof s.outgoingMessages).toBe('number');
    expect(typeof s.aiGeneratedReplies).toBe('number');
    expect(typeof s.manualReplies).toBe('number');
    expect(s.totalMessages).toBeGreaterThanOrEqual(0);
    expect(s.incomingMessages + s.outgoingMessages).toBe(s.totalMessages);
    expect(s.manualReplies + s.aiGeneratedReplies).toBe(s.outgoingMessages);

    if (data.timeline.length > 0) {
      const day = data.timeline[0];
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('incoming');
      expect(day).toHaveProperty('outgoing');
      expect(day).toHaveProperty('aiGenerated');
    }
    if (data.topContacts.length > 0) {
      const c = data.topContacts[0];
      expect(c).toHaveProperty('contactId');
      expect(c).toHaveProperty('nickname');
      expect(c).toHaveProperty('messageCount');
    }
  }, 10000);
});
