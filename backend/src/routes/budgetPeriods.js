const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parseYmd, inclusiveDayCount, eachUtcDate } = require('../utils/timeLogic');
const { parseAmountFen } = require('../utils/money');
const { userId } = require('../middleware/auth');

const router = express.Router();

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function requireYmd(value, label) {
  const d = parseYmd(value);
  if (!d) throw httpError(400, `无效日期: ${label}`, 'VALIDATION_ERROR');
  return d;
}

function parsePeriodBody(body) {
  const title = String(body.title || '').trim();
  if (!title) throw httpError(400, '标题不能为空', 'VALIDATION_ERROR');
  if (title.length > 200) throw httpError(400, '标题过长', 'VALIDATION_ERROR');
  const start_date = requireYmd(body.start_date, 'start_date');
  const end_date = requireYmd(body.end_date, 'end_date');
  const days = inclusiveDayCount(start_date, end_date);
  if (days == null || days < 1 || days > 366) {
    throw httpError(400, '时段须为 1–366 个日历日（含）', 'VALIDATION_ERROR');
  }
  const planned_amount_fen = parseAmountFen(body.planned_amount_fen);
  if (planned_amount_fen == null) {
    throw httpError(400, '预算金额须为 1–1000000000 分', 'VALIDATION_ERROR');
  }
  let description = body.description;
  if (description == null || description === '') description = null;
  else {
    description = String(description);
    if (description.length > 2000) {
      throw httpError(400, '备注过长', 'VALIDATION_ERROR');
    }
  }
  return { title, description, start_date, end_date, planned_amount_fen };
}

function shapePeriod(row) {
  const planned = Number(row.planned_amount_fen);
  const spent = Number(row.spent_fen || 0);
  const count = Number(row.expense_count || 0);
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    start_date: String(row.start_date).slice(0, 10),
    end_date: String(row.end_date).slice(0, 10),
    planned_amount_fen: planned,
    spent_fen: spent,
    remaining_fen: Math.max(planned - spent, 0),
    progress_percent: planned > 0 ? Math.round((spent / planned) * 100) : 0,
    overspent: spent > planned,
    expense_count: count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function attachSpent(ids, uid) {
  if (!ids.length) return {};
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query(
    `SELECT p2.id AS period_id,
            COALESCE(SUM(e.amount_fen), 0) AS spent_fen,
            COUNT(e.id) AS expense_count
     FROM budget_periods p2
     LEFT JOIN expense_entries e
       ON e.user_id = p2.user_id
      AND e.occurred_date BETWEEN p2.start_date AND p2.end_date
     WHERE p2.user_id = ? AND p2.id IN (${placeholders})
     GROUP BY p2.id`,
    [uid, ...ids]
  );
  const map = {};
  for (const r of rows) {
    map[Number(r.period_id)] = {
      spent_fen: Number(r.spent_fen),
      expense_count: Number(r.expense_count),
    };
  }
  return map;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { date, from, to, q } = req.query;
    if ((from && !to) || (!from && to)) {
      throw httpError(400, 'from 与 to 必须同时提供', 'INCOMPLETE_RANGE');
    }
    const uid = userId(req);
    let sql = 'SELECT * FROM budget_periods WHERE user_id = ?';
    const params = [uid];
    if (date) {
      const d = requireYmd(date, 'date');
      sql += ' AND start_date <= ? AND end_date >= ?';
      params.push(d, d);
    }
    if (from && to) {
      const f = requireYmd(from, 'from');
      const t = requireYmd(to, 'to');
      sql += ' AND start_date <= ? AND end_date >= ?';
      params.push(t, f);
    }
    if (q && String(q).trim()) {
      sql += ' AND title LIKE ?';
      params.push(`%${String(q).trim()}%`);
    }
    sql += ' ORDER BY start_date DESC, id DESC';
    const rows = await query(sql, params);
    const ids = rows.map((r) => r.id);
    const spentMap = await attachSpent(ids, uid);
    res.json({
      success: true,
      data: rows.map((r) =>
        shapePeriod({ ...r, ...(spentMap[Number(r.id)] || { spent_fen: 0, expense_count: 0 }) })
      ),
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const rows = await query(
      'SELECT * FROM budget_periods WHERE id = ? AND user_id = ?',
      [req.params.id, uid]
    );
    if (!rows.length) throw httpError(404, '预算时段不存在', 'BUDGET_NOT_FOUND');
    const spentMap = await attachSpent([rows[0].id], uid);
    const base = shapePeriod({
      ...rows[0],
      ...(spentMap[Number(rows[0].id)] || { spent_fen: 0, expense_count: 0 }),
    });
    const dailyRows = await query(
      `SELECT occurred_date AS day,
              COALESCE(SUM(amount_fen), 0) AS spend_fen,
              COUNT(*) AS expense_count
       FROM expense_entries
       WHERE user_id = ? AND occurred_date BETWEEN ? AND ?
       GROUP BY occurred_date`,
      [uid, base.start_date, base.end_date]
    );
    const map = {};
    for (const r of dailyRows) {
      const key = String(r.day).slice(0, 10);
      map[key] = {
        day: key,
        spend_fen: Number(r.spend_fen),
        expense_count: Number(r.expense_count),
      };
    }
    const daily = eachUtcDate(base.start_date, base.end_date).map(
      (day) => map[day] || { day, spend_fen: 0, expense_count: 0 }
    );
    res.json({ success: true, data: { ...base, daily } });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const body = parsePeriodBody(req.body || {});
    const result = await query(
      `INSERT INTO budget_periods
        (user_id, title, description, start_date, end_date, planned_amount_fen)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uid,
        body.title,
        body.description,
        body.start_date,
        body.end_date,
        body.planned_amount_fen,
      ]
    );
    const created = await query('SELECT * FROM budget_periods WHERE id = ?', [
      result.insertId,
    ]);
    res.status(201).json({
      success: true,
      data: shapePeriod({ ...created[0], spent_fen: 0, expense_count: 0 }),
    });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const existing = await query(
      'SELECT id FROM budget_periods WHERE id = ? AND user_id = ?',
      [req.params.id, uid]
    );
    if (!existing.length) throw httpError(404, '预算时段不存在', 'BUDGET_NOT_FOUND');
    const body = parsePeriodBody(req.body || {});
    await query(
      `UPDATE budget_periods
       SET title = ?, description = ?, start_date = ?, end_date = ?, planned_amount_fen = ?
       WHERE id = ? AND user_id = ?`,
      [
        body.title,
        body.description,
        body.start_date,
        body.end_date,
        body.planned_amount_fen,
        req.params.id,
        uid,
      ]
    );
    const rows = await query(
      'SELECT * FROM budget_periods WHERE id = ? AND user_id = ?',
      [req.params.id, uid]
    );
    const spentMap = await attachSpent([rows[0].id], uid);
    res.json({
      success: true,
      data: shapePeriod({
        ...rows[0],
        ...(spentMap[Number(rows[0].id)] || { spent_fen: 0, expense_count: 0 }),
      }),
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await query(
      'SELECT id FROM budget_periods WHERE id = ? AND user_id = ?',
      [req.params.id, userId(req)]
    );
    if (!existing.length) throw httpError(404, '预算时段不存在', 'BUDGET_NOT_FOUND');
    await query('DELETE FROM budget_periods WHERE id = ? AND user_id = ?', [
      req.params.id,
      userId(req),
    ]);
    res.json({ success: true, data: { id: Number(req.params.id) } });
  })
);

module.exports = router;
