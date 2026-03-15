import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const BASE = '/api/v1';
const PHONE = '13900001234';
const PASSWORD = 'TestPass1';
const NICKNAME = 'SceneTestUser';

describe('Scene (e2e) - create scene and activate/switch', () => {
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

    const registerRes = await request(app.getHttpServer())
      .post(`${BASE}/auth/register`)
      .send({
        phone: PHONE,
        password: PASSWORD,
        nickname: NICKNAME,
        verifyCode: '123456',
      });

    if (registerRes.status === 409) {
      // User already exists, login instead
    } else {
      expect(registerRes.status).toBe(201);
    }

    const loginRes = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ phone: PHONE, password: PASSWORD })
      .expect(200);

    const body = loginRes.body as { data?: { data?: { accessToken?: string } } };
    accessToken = body.data?.data?.accessToken as string;
    expect(accessToken).toBeDefined();
  }, 15000);

  afterAll(async () => {
    await app?.close();
  });

  const auth = (method: 'get' | 'post' | 'put' | 'delete') =>
    (url: string) => {
      const req = request(app.getHttpServer())[method](url);
      return req.set('Authorization', `Bearer ${accessToken}`);
    };

  it('should create scene A and activate it', async () => {
    const createRes = await auth('post')(`${BASE}/scenes`)
      .send({
        name: '工作模式',
        description: '工作时间自动回复',
        replyStyle: 'formal',
        autoReply: true,
        rules: {
          schedule: { enabled: true, startTime: '09:00', endTime: '18:00', weekdays: [1, 2, 3, 4, 5] },
          contactLevels: ['important', 'normal'],
          platforms: ['wechat'],
          maxReplyDelay: 30,
        },
      })
      .expect(201);

    const sceneA = (createRes.body as { data?: { id?: string } }).data;
    expect(sceneA?.id).toBeDefined();

    const activateRes = await auth('post')(`${BASE}/scenes/${sceneA!.id}/activate`)
      .expect(200);

    const wrap = activateRes.body as { data?: { data?: { activatedScene: string; deactivatedScene: string | null } } };
    const activateData = (wrap.data?.data ?? wrap.data) as { activatedScene: string; deactivatedScene: string | null } | undefined;
    expect(activateData?.activatedScene).toBe(sceneA!.id);
    expect(activateData?.deactivatedScene).toBeNull();

    const activeRes = await auth('get')(`${BASE}/scenes/active`).expect(200);
    const active = (activeRes.body as { data?: { id?: string; name?: string; isActive?: boolean } }).data;
    expect(active?.id).toBe(sceneA!.id);
    expect(active?.name).toBe('工作模式');
    expect(active?.isActive).toBe(true);
  });

  it('should create scene B and switch to it (A deactivated)', async () => {
    const listRes = await auth('get')(`${BASE}/scenes`).expect(200);
    const list = (listRes.body as { data?: Array<{ id: string; name: string; isActive: boolean }> }).data ?? listRes.body as Array<{ id: string; name: string; isActive: boolean }>;
    const sceneA = list.find((s) => s.name === '工作模式');
    expect(sceneA?.isActive).toBe(true);

    const createRes = await auth('post')(`${BASE}/scenes`)
      .send({
        name: '休息模式',
        description: '下班后简短回复',
        replyStyle: 'casual',
        autoReply: true,
        rules: {
          schedule: { enabled: true, startTime: '18:00', endTime: '09:00', weekdays: [1, 2, 3, 4, 5, 6, 7] },
          contactLevels: ['important'],
          autoApprove: true,
          maxReplyDelay: 120,
        },
      })
      .expect(201);

    const sceneB = (createRes.body as { data?: { id?: string } }).data;
    expect(sceneB?.id).toBeDefined();

    const activateRes = await auth('post')(`${BASE}/scenes/${sceneB!.id}/activate`)
      .expect(200);

    const wrap2 = activateRes.body as { data?: { data?: { activatedScene: string; deactivatedScene: string | null } } };
    const activateData2 = (wrap2.data?.data ?? wrap2.data) as { activatedScene: string; deactivatedScene: string | null } | undefined;
    expect(activateData2?.activatedScene).toBe(sceneB!.id);
    expect(activateData2?.deactivatedScene).toBe(sceneA!.id);

    const activeRes = await auth('get')(`${BASE}/scenes/active`).expect(200);
    const active = (activeRes.body as { data?: { id?: string; name?: string } }).data;
    expect(active?.id).toBe(sceneB!.id);
    expect(active?.name).toBe('休息模式');

    const listRes2 = await auth('get')(`${BASE}/scenes`).expect(200);
    const list2 = (listRes2.body as { data?: Array<{ id: string; name: string; isActive: boolean }> }).data ?? listRes2.body as Array<{ id: string; name: string; isActive: boolean }>;
    const activeCount = list2.filter((s) => s.isActive).length;
    expect(activeCount).toBe(1);
    expect(list2.find((s) => s.name === '工作模式')?.isActive).toBe(false);
    expect(list2.find((s) => s.name === '休息模式')?.isActive).toBe(true);
  });
});
