/**
 * Self-test: WebSocket connection + receive push event.
 * Usage: node scripts/websocket-self-test.mjs [base_url]
 * Example: npm run start:dev & sleep 5 && npm run self-test:websocket
 * Requires: app running, DB + Redis; uses same test user as auth-flow-e2e.
 */

import { io } from 'socket.io-client';

const BASE = process.argv[2] || 'http://localhost:3000';
const API_BASE = `${BASE}/api/v1`;
const PHONE = '13900001111';
const PASSWORD = 'TestPass123!';

let connected = false;
let receivedPayload = null;

async function ensureUser() {
  await fetch(`${API_BASE}/auth/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, purpose: 'register' }),
  });
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: PHONE,
      password: PASSWORD,
      nickname: 'WS自测用户',
      verifyCode: '123456',
    }),
  });
  const regBody = await regRes.json();
  if (regRes.status !== 201 && !regBody?.message?.includes('PHONE_ALREADY_EXISTS') && !regBody?.error) {
    // ignore already exists
  }
}

async function login() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Login failed ${res.status}: ${JSON.stringify(json)}`);
  }
  const token = json?.data?.accessToken ?? json?.data?.data?.accessToken;
  if (!token) {
    throw new Error('No accessToken in login response: ' + JSON.stringify(json));
  }
  return token;
}

async function createNotification(accessToken) {
  const res = await fetch(`${API_BASE}/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      type: 'info',
      title: 'WebSocket 自测',
      content: '收到此条说明实时推送正常',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create notification failed ${res.status}: ${text}`);
  }
  return res.json();
}

function run() {
  return new Promise((resolve, reject) => {
    ensureUser()
      .then(() => login())
      .then((token) => {
        console.log('[1/3] Login OK, connecting WebSocket...');
        const socket = io(`${BASE}/ws`, {
          path: '/api/v1/socket.io',
          auth: { token: `Bearer ${token}` },
          transports: ['polling', 'websocket'],
        });

        const timeout = setTimeout(() => {
          socket.close();
          if (connected && receivedPayload) {
            console.log('[3/3] Received push event:', JSON.stringify(receivedPayload, null, 2));
            resolve(0);
          } else {
            console.error('[FAIL] No notification event received in time (connected:', connected, ')');
            resolve(1);
          }
        }, 5000);

        socket.on('connect', async () => {
          connected = true;
          console.log('[2/3] WebSocket connected, triggering push...');
          try {
            await createNotification(token);
          } catch (e) {
            clearTimeout(timeout);
            socket.close();
            reject(e);
          }
        });

        socket.on('notification', (payload) => {
          receivedPayload = payload;
          clearTimeout(timeout);
          socket.close();
          console.log('[3/3] Received push event:', JSON.stringify(payload, null, 2));
          resolve(0);
        });

        socket.on('connect_error', (err) => {
          clearTimeout(timeout);
          console.error('[FAIL] connect_error:', err.message, err.description || '');
          resolve(1);
        });
      })
      .catch((err) => {
        console.error('[FAIL]', err.message);
        resolve(1);
      });
  });
}

run()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
