const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parseYmd } = require('../utils/timeLogic');
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

function parseExpenseBody(body) {
  const title = String(body.title || '').trim();
  if (!title || title.length > 200) {
    throw httpError(400, '条目名称须为 1–200 字', 'VALIDATION_ERROR');
  }
  const occurred_date = requireYmd(body.occurred_date, 'occurred_date');
  const amount_fen = parseAmountFen(body.amount_fen);
  if (amount_fen == null) {
    throw httpError(400, '金额须为 1–1000000000 分', 'VALIDATION_ERROR');
  }
  let note = body.note;
  if (note == null || note === '') note = null;
  else {
    note = String(note);
    if (note.length > 500) throw httpError(400, '备注过长', 'VALIDATION_ERROR');
  }
  return { title, occurred_date, amount_fen, note };
}

function shape(row) {
  return {
    id: Number(row.id),
    occurred_date: String(row.occurred_date).slice(0, 10),
    title: row.title,
    amount_fen: Number(row.amount_fen),
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { date, from, to, limit = 100 } = req.query;
    if ((from && !to) || (!from && to)) {
      throw httpError(400, 'from 与 to 必须同时提供', 'INCOMPLETE_RANGE');
    }
    const uid = userId(req);
    let sql = 'SELECT * FROM expense_entries WHERE user_id = ?';
    const params = [uid];
    if (date) {
      sql += ' AND occurred_date = ?';
      params.push(requireYmd(date, 'date'));
    }
    if (from && to) {
      sql += ' AND occurred_date >= ? AND occurred_date <= ?';
      params.push(requireYmd(from, 'from'), requireYmd(to, 'to'));
    }
    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    sql += ` ORDER BY occurred_date DESC, created_at DESC, id DESC LIMIT ${lim}`;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows.map(shape) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const rows = await query(
      'SELECT * FROM expense_entries WHERE id = ? AND user_id = ?',
      [req.params.id, userId(req)]
    );
    if (!rows.length) throw httpError(404, '支出不存在', 'EXPENSE_NOT_FOUND');
    res.json({ success: true, data: shape(rows[0]) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const body = parseExpenseBody(req.body || {});
    const result = await query(
      `INSERT INTO expense_entries (user_id, occurred_date, title, amount_fen, note)
       VALUES (?, ?, ?, ?, ?)`,
      [uid, body.occurred_date, body.title, body.amount_fen, body.note]
    );
    const rows = await query(
      'SELECT * FROM expense_entries WHERE id = ? AND user_id = ?',
      [result.insertId, uid]
    );
    res.status(201).json({ success: true, data: shape(rows[0]) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const existing = await query(
      'SELECT id FROM expense_entries WHERE id = ? AND user_id = ?',
      [req.params.id, uid]
    );
    if (!existing.length) throw httpError(404, '支出不存在', 'EXPENSE_NOT_FOUND');
    const body = parseExpenseBody(req.body || {});
    await query(
      `UPDATE expense_entries
       SET occurred_date = ?, title = ?, amount_fen = ?, note = ?
       WHERE id = ? AND user_id = ?`,
      [body.occurred_date, body.title, body.amount_fen, body.note, req.params.id, uid]
    );
    const rows = await query(
      'SELECT * FROM expense_entries WHERE id = ? AND user_id = ?',
      [req.params.id, uid]
    );
    res.json({ success: true, data: shape(rows[0]) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await query(
      'SELECT id FROM expense_entries WHERE id = ? AND user_id = ?',
      [req.params.id, userId(req)]
    );
    if (!existing.length) throw httpError(404, '支出不存在', 'EXPENSE_NOT_FOUND');
    await query('DELETE FROM expense_entries WHERE id = ? AND user_id = ?', [
      req.params.id,
      userId(req),
    ]);
    res.json({ success: true, data: { id: Number(req.params.id) } });
  })
);

module.exports = router;
