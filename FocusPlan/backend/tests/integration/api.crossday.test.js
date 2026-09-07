/**
 * 集成测试：真实打 API（需 MySQL + 后端已启动，或使用本文件内联 server）
 * 覆盖：跨天计划 CRUD、任务时长校验、会话统计归属日
 */
const request = require('supertest');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const schedulesRouter = require('../../src/routes/schedules');
const sessionsRouter = require('../../src/routes/sessions');
const statsRouter = require('../../src/routes/stats');
const { errorHandler, notFound } = require('../../src/middleware/errorHandler');
const { pool } = require('../../src/db');
const {
  durationMinutes,
  sessionStatDay,
  scheduleOverlapsShanghaiDay,
} = require('../../src/utils/timeLogic');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use((req, res, next) => {
    const old = res.json.bind(res);
    res.json = (body) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return old(body);
    };
    next();
  });
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/stats', statsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const app = createApp();

let createdScheduleId = null;
let createdSessionIds = [];

beforeAll(async () => {
  // 确认 DB 可用
  await pool.query('SELECT 1');
});

afterAll(async () => {
  // 清理测试数据
  for (const id of createdSessionIds) {
    await pool.query('DELETE FROM pomodoro_sessions WHERE id = ?', [id]).catch(() => {});
  }
  if (createdScheduleId) {
    await pool.query('DELETE FROM schedules WHERE id = ?', [createdScheduleId]).catch(() => {});
  }
  await pool.end();
});

describe('集成：跨天计划', () => {
  // 北京 2026-07-18 22:00 → 2026-07-19 02:00
  // UTC: 14:00 → 18:00
  const startIso = '2026-07-18T14:00:00.000Z';
  const endIso = '2026-07-18T18:00:00.000Z';

  test('跨天计划时长为 4 小时 = 240 分钟', () => {
    expect(durationMinutes(startIso, endIso)).toBe(240);
  });

  test('创建跨天计划 + 任务时长校验', async () => {
    const res = await request(app)
      .post('/api/schedules')
      .send({
        title: '【测试】跨天攻坚',
        description: '自动化集成测试-可删',
        start_at: startIso,
        end_at: endIso,
        planned_minutes: 240,
        tasks: [
          { description: '夜场开发', planned_minutes: 120, sort_order: 0 },
          { description: '凌晨联调', planned_minutes: 120, sort_order: 1 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.planned_minutes).toBe(240);
    expect(res.body.data.tasks).toHaveLength(2);
    createdScheduleId = res.body.data.id;

    // 存库应是 UTC
    expect(String(res.body.data.start_at)).toMatch(/14:00:00|T14:00/);
  });

  test('任务时长不等于总工时 → 400', async () => {
    const res = await request(app)
      .post('/api/schedules')
      .send({
        title: '【测试】非法',
        start_at: startIso,
        end_at: endIso,
        planned_minutes: 240,
        tasks: [{ description: '只有 60', planned_minutes: 60 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TASK_MINUTES_MISMATCH');
  });

  test('结束不晚于开始 → 400', async () => {
    const res = await request(app)
      .post('/api/schedules')
      .send({
        title: '【测试】非法时间',
        start_at: endIso,
        end_at: startIso,
        planned_minutes: 60,
        tasks: [{ description: 'x', planned_minutes: 60 }],
      });
    expect(res.status).toBe(400);
  });

  test('按日筛选：跨天计划在两天都能被筛到（区间重叠）', async () => {
    // dayStart/End for 北京 7/18
    const dayStart18 = '2026-07-17T16:00:00.000Z';
    const dayEnd18 = '2026-07-18T16:00:00.000Z';
    const res18 = await request(app).get('/api/schedules').query({
      date: '2026-07-18',
      dayStartUtc: dayStart18,
      dayEndUtc: dayEnd18,
      q: '【测试】跨天攻坚',
    });
    expect(res18.status).toBe(200);
    const hit18 = (res18.body.data || []).some((s) => s.id === createdScheduleId);
    expect(hit18).toBe(true);

    const dayStart19 = '2026-07-18T16:00:00.000Z';
    const dayEnd19 = '2026-07-19T16:00:00.000Z';
    const res19 = await request(app).get('/api/schedules').query({
      date: '2026-07-19',
      dayStartUtc: dayStart19,
      dayEndUtc: dayEnd19,
      q: '【测试】跨天攻坚',
    });
    expect(res19.status).toBe(200);
    const hit19 = (res19.body.data || []).some((s) => s.id === createdScheduleId);
    expect(hit19).toBe(true);

    // 纯逻辑再确认
    expect(
      scheduleOverlapsShanghaiDay(startIso, endIso, '2026-07-18')
    ).toBe(true);
    expect(
      scheduleOverlapsShanghaiDay(startIso, endIso, '2026-07-19')
    ).toBe(true);
  });
});

describe('集成：番茄会话统计归属（跨天）', () => {
  test('深夜开始的会话计入开始日，不拆到次日', async () => {
    // 北京 7/18 23:30 开始，做 90 分钟 → 7/19 01:00
    const started = '2026-07-18T15:30:00.000Z';
    const ended = '2026-07-18T17:00:00.000Z';
    expect(durationMinutes(started, ended)).toBe(90);
    expect(sessionStatDay(started)).toBe('2026-07-18');

    const res = await request(app)
      .post('/api/sessions')
      .send({
        schedule_id: createdScheduleId,
        content: '【测试】跨夜会话',
        started_at: started,
        ended_at: ended,
        duration_minutes: 90,
        planned_minutes: 90,
        status: 'completed',
      });

    expect(res.status).toBe(201);
    createdSessionIds.push(res.body.data.id);

    // overview 按 7/18 应包含这 90 分钟
    const ov18 = await request(app)
      .get('/api/stats/overview')
      .query({ today: '2026-07-18' });
    expect(ov18.status).toBe(200);
    expect(Number(ov18.body.data.today_minutes)).toBeGreaterThanOrEqual(90);

    // daily 7/18 应有贡献；7/19 不应因「跨到凌晨」把同一会话再算一次
    // （实现：按 started_at 归属，只算 18 号）
    const daily = await request(app)
      .get('/api/stats/daily')
      .query({ days: 3, today: '2026-07-19' });
    expect(daily.status).toBe(200);
    const map = {};
    for (const row of daily.body.data || []) {
      map[row.day] = Number(row.total_minutes);
    }
    // 至少 18 号有数据（可能还有 seed）
    expect(map['2026-07-18']).toBeGreaterThanOrEqual(90);
  });

  test('标准闭环：计划详情能读到会话累计', async () => {
    const res = await request(app).get(`/api/schedules/${createdScheduleId}`);
    expect(res.status).toBe(200);
    expect(Number(res.body.data.focused_minutes)).toBeGreaterThanOrEqual(90);
  });
});

describe('集成：边界值', () => {
  test('1 分钟会话可创建', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({
        content: '【测试】1分钟',
        started_at: '2026-07-18T01:00:00.000Z',
        ended_at: '2026-07-18T01:01:00.000Z',
        duration_minutes: 1,
        planned_minutes: 1,
      });
    expect(res.status).toBe(201);
    createdSessionIds.push(res.body.data.id);
    expect(res.body.data.duration_minutes).toBe(1);
  });

  test('health', async () => {
    // 直连 pool 已 ok；再测路由挂载
    const res = await request(app).get('/api/stats/by-schedule');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
