require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const request = require('supertest');
const { pool } = require('../../src/db');
const { createApp, createTestUser, authed, deleteTestUser } = require('../helpers/auth');

process.env.AUTH_DEV_ECHO_CODE = '1';
process.env.NODE_ENV = 'test';

const app = createApp();
const createdEmails = [];

afterAll(async () => {
  for (const email of createdEmails) {
    await pool.query('DELETE FROM email_codes WHERE email = ?', [email]).catch(() => {});
    await pool.query('DELETE FROM users WHERE email = ?', [email]).catch(() => {});
  }
  await pool.end();
});

describe('认证：邮箱验证码注册 / 登录 / 数据隔离', () => {
  test('未登录访问业务接口 → 401', async () => {
    const res = await request(app).get('/api/schedules');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('发码 + 注册 + 登录', async () => {
    const email = `auth_${Date.now()}@starway.test`;
    createdEmails.push(email);

    const sent = await request(app)
      .post('/api/auth/send-code')
      .send({ email, purpose: 'register' });
    expect(sent.status).toBe(200);
    expect(sent.body.devCode).toMatch(/^\d{6}$/);

    const bad = await request(app).post('/api/auth/register').send({
      email,
      password: 'password12',
      code: '000000',
    });
    expect(bad.status).toBe(400);

    const reg = await request(app).post('/api/auth/register').send({
      email,
      password: 'password12',
      code: sent.body.devCode,
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe(email);
    expect(reg.body.accessToken).toBeTruthy();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'password12' });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();

    const me = await request(app)
      .get('/api/auth/me')
      .set({ Authorization: `Bearer ${login.body.accessToken}` });
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
  });

  test('两个账号互不可见计划', async () => {
    const a = await createTestUser('iso_a');
    const b = await createTestUser('iso_b');
    createdEmails.push(a.email, b.email);

    const created = await authed(app, a)
      .post('/api/schedules')
      .send({
        title: '【测试】仅 A 可见',
        start_at: '2026-07-18T14:00:00.000Z',
        end_at: '2026-07-18T15:00:00.000Z',
        planned_minutes: 60,
        tasks: [{ description: 'A 的任务', planned_minutes: 60 }],
      });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const listB = await authed(app, b).get('/api/schedules');
    expect(listB.status).toBe(200);
    expect((listB.body.data || []).some((s) => s.id === id)).toBe(false);

    const getB = await authed(app, b).get(`/api/schedules/${id}`);
    expect(getB.status).toBe(404);

    await pool.query('DELETE FROM schedules WHERE id = ?', [id]).catch(() => {});
    await deleteTestUser(a.id);
    await deleteTestUser(b.id);
  });
});
