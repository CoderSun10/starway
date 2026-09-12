require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { pool } = require('../../src/db');
const { inclusiveDayCount } = require('../../src/utils/timeLogic');
const {
  createApp,
  createTestUser,
  authed,
  deleteTestUser,
} = require('../helpers/auth');

const app = createApp();
let user;
function req() {
  return authed(app, user);
}
const createdPeriodIds = [];
const createdExpenseIds = [];

beforeAll(async () => {
  await pool.query('SELECT 1');
  user = await createTestUser('ledger');
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
  await deleteTestUser(user?.id);
  await pool.end();
});

describe('账本 API', () => {
  test('非法日期 02-31 → 400', async () => {
    const res = await req()
      .post('/api/expenses')
      .send({ occurred_date: '2026-02-31', title: '【测试】坏日期', amount_fen: 100 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('end < start → 400', async () => {
    const res = await req().post('/api/budget-periods').send({
      title: '【测试】反序',
      start_date: '2026-09-10',
      end_date: '2026-09-01',
      planned_amount_fen: 1000,
    });
    expect(res.status).toBe(400);
  });

  test('跨度 367 → 400', async () => {
    const res = await req().post('/api/budget-periods').send({
      title: '【测试】过长',
      start_date: '2024-01-01',
      end_date: '2025-01-01',
      planned_amount_fen: 1000,
    });
    expect(res.status).toBe(400);
    expect(inclusiveDayCount('2024-01-01', '2025-01-01')).toBe(367);
  });

  test('创建时段 + 记账 + 列表 spent JOIN', async () => {
    const period = await req().post('/api/budget-periods').send({
      title: '【测试】九月预算',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      planned_amount_fen: 300000,
    });
    expect(period.status).toBe(201);
    createdPeriodIds.push(period.body.data.id);

    const e1 = await req().post('/api/expenses').send({
      occurred_date: '2026-09-10',
      title: '【测试】午餐',
      amount_fen: 3200,
    });
    expect(e1.status).toBe(201);
    createdExpenseIds.push(e1.body.data.id);

    const list = await req().get('/api/budget-periods?date=2026-09-10');
    expect(list.status).toBe(200);
    const row = list.body.data.find((p) => p.id === period.body.data.id);
    expect(row.spent_fen).toBeGreaterThanOrEqual(3200);
  });

  test('day-summary 2026-08-31 … 2026-10-11 → 200 且 42 天', async () => {
    const res = await req().get(
      '/api/stats/day-summary?from=2026-08-31&to=2026-10-11'
    );
    expect(res.status).toBe(200);
    expect(res.body.data.days).toHaveLength(42);
  });
});
