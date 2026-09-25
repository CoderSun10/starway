const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parseAmountFen } = require('../utils/money');
const { fixedSpendInRange, monthEndOf } = require('../utils/fixedSpend');
const { userId } = require('../middleware/auth');

const router = express.Router();

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function requireMonth(value) {
  const s = String(value || '').trim();
  if (!MONTH_RE.test(s)) throw httpError(400, '无效月份', 'VALIDATION_ERROR');
  const year = Number(s.slice(0, 4));
  if (year < 2000 || year > 2100) {
    throw httpError(400, '月份超出范围', 'VALIDATION_ERROR');
  }
  return s;
}

function monthRange(month) {
  return { start: `${month}-01`, end: `${month}-${String(monthEndOf(month)).padStart(2, '0')}` };
}

/** 某月实际花费：记账流水 + 当月归属的固定支出 */
async function spentInMonth(uid, month) {
  const { start, end } = monthRange(month);
  const rows = await query(
    `SELECT COALESCE(SUM(amount_fen), 0) AS spend_fen, COUNT(*) AS expense_count
     FROM expense_entries
     WHERE user_id = ? AND occurred_date >= ? AND occurred_date <= ?`,
    [uid, start, end]
  );
  const fixed = await fixedSpendInRange(uid, start, end);
  return {
    spent_fen: Number(rows[0].spend_fen) + fixed,
    expense_count: Number(rows[0].expense_count),
    fixed_fen: fixed,
  };
}

function shape(row, spent) {
  return {
    month: row.month,
    planned_amount_fen: row.planned_amount_fen == null ? null : Number(row.planned_amount_fen),
    spent_fen: spent.spent_fen,
    fixed_fen: spent.fixed_fen,
    expense_count: spent.expense_count,
  };
}

// GET /api/month-budgets?months=2026-09,2026-08
// 返回这些月份的框架（有预算行的给预算，没有的 planned=null），均带当月花费
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    let months = String(req.query.months || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(requireMonth);
    const stored = await query(
      'SELECT * FROM monthly_budgets WHERE user_id = ? ORDER BY month DESC',
      [uid]
    );
    const byMonth = new Map(stored.map((r) => [r.month, r]));
    for (const r of stored) if (!months.includes(r.month)) months.push(r.month);
    months = [...new Set(months)].sort().reverse();
    const data = await Promise.all(
      months.map(async (m) =>
        shape(byMonth.get(m) || { month: m, planned_amount_fen: null }, await spentInMonth(uid, m))
      )
    );
    res.json({ success: true, data });
  })
);

// PUT /api/month-budgets/:month { planned_amount_fen }
router.put(
  '/:month',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const month = requireMonth(req.params.month);
    const fen = parseAmountFen((req.body || {}).planned_amount_fen);
    if (fen == null) {
      throw httpError(400, '预算金额须为 1–1000000000 分', 'VALIDATION_ERROR');
    }
    await query(
      `INSERT INTO monthly_budgets (user_id, month, planned_amount_fen)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE planned_amount_fen = VALUES(planned_amount_fen)`,
      [uid, month, fen]
    );
    const spent = await spentInMonth(uid, month);
    res.json({
      success: true,
      data: shape({ month, planned_amount_fen: fen }, spent),
    });
  })
);

module.exports = router;
