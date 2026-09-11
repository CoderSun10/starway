const request = require('supertest');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const budgetPeriodsRouter = require('../../src/routes/budgetPeriods');
const expensesRouter = require('../../src/routes/expenses');
const statsRouter = require('../../src/routes/stats');
const { errorHandler, notFound } = require('../../src/middleware/errorHandler');
const { pool } = require('../../src/db');
const { inclusiveDayCount } = require('../../src/utils/timeLogic');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/budget-periods', budgetPeriodsRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/stats', statsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const app = createApp();
const createdPeriodIds = [];
const createdExpenseIds = [];

beforeAll(async () => {
  await pool.query('SELECT 1');
});

afterAll(async () => {
  for (const id of createdExpenseIds) {
    await pool.query('DELETE FROM expense_entries WHERE id = ?', [id]).catch(() => {});
  }
  await pool.query("DELETE FROM expense_entries WHERE title LIKE '【测试】%'").catch(() => {});
  for (const id of createdPeriodIds) {
    await pool.query('DELETE FROM budget_periods WHERE id = ?', [id]).catch(() => {});
  }
  await pool.query("DELETE FROM budget_periods WHERE title LIKE '【测试】%'").catch(() => {});
  await pool.end();
});

describe('账本 API', () => {
  test('非法日期 02-31 → 400', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ occurred_date: '2026-02-31', title: '【测试】坏日期', amount_fen: 100 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('end < start → 400', async () => {
    const res = await request(app).post('/api/budget-periods').send({
      title: '【测试】反序',
      start_date: '2026-09-10',
      end_date: '2026-09-01',
      planned_amount_fen: 1000,
    });
    expect(res.status).toBe(400);
  });

  test('跨度 367 → 400', async () => {
    const res = await request(app).post('/api/budget-periods').send({
      title: '【测试】过长',
      start_date: '2024-01-01',
      end_date: '2025-01-01',
      planned_amount_fen: 1000,
    });
    expect(res.status).toBe(400);
    expect(inclusiveDayCount('2024-01-01', '2025-01-01')).toBe(367);
  });

  test('创建时段 + 记账 + 列表 spent JOIN', async () => {
    const period = await request(app).post('/api/budget-periods').send({
      title: '【测试】九月预算',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      planned_amount_fen: 300000,
    });
    expect(period.status).toBe(201);
    createdPeriodIds.push(period.body.data.id);

    const e1 = await request(app).post('/api/expenses').send({
      occurred_date: '2026-09-10',
      title: '【测试】午餐',
      amount_fen: 3200,
    });
    expect(e1.status).toBe(201);
    createdExpenseIds.push(e1.body.data.id);

    const list = await request(app).get('/api/budget-periods?date=2026-09-10');
    expect(list.status).toBe(200);
    const row = list.body.data.find((p) => p.id === period.body.data.id);
    expect(row.spent_fen).toBeGreaterThanOrEqual(3200);
  });

  test('day-summary 2026-08-31 … 2026-10-11 → 200 且 42 天', async () => {
    const res = await request(app).get(
      '/api/stats/day-summary?from=2026-08-31&to=2026-10-11'
    );
    expect(res.status).toBe(200);
    expect(res.body.data.days).toHaveLength(42);
  });
});
