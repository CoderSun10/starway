const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { parseAmountFen } = require('../utils/money');
const { shanghaiDateOf } = require('../utils/timeLogic');
const { userId } = require('../middleware/auth');

const router = express.Router();

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MAX_ITEMS = 200;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function requireMonth(value, label = 'month') {
  const s = String(value || '').trim();
  const m = MONTH_RE.exec(s);
  if (!m) throw httpError(400, `无效月份: ${label}`, 'VALIDATION_ERROR');
  const year = Number(m[1]);
  if (year < 2000 || year > 2100) {
    throw httpError(400, '月份超出范围', 'VALIDATION_ERROR');
  }
  return s;
}

function currentMonth() {
  return shanghaiDateOf(new Date()).slice(0, 7);
}

/** 某月天数 */
function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 扣款日在当月的实际日期：31 号遇到小月就落到当月最后一天 */
function dueDateOf(month, dueDay) {
  const day = Math.min(Math.max(Number(dueDay) || 1, 1), daysInMonth(month));
  return `${month}-${String(day).padStart(2, '0')}`;
}

function parseItemBody(body) {
  const title = String(body.title || '').trim();
  if (!title || title.length > 200) {
    throw httpError(400, '名称须为 1–200 字', 'VALIDATION_ERROR');
  }
  let category = String(body.category ?? '').trim();
  if (!category) category = '其他';
  if (category.length > 50) throw httpError(400, '分类过长', 'VALIDATION_ERROR');

  const expected_amount_fen = parseAmountFen(body.expected_amount_fen);
  if (expected_amount_fen == null) {
    throw httpError(400, '每月金额须为 1–1000000000 分', 'VALIDATION_ERROR');
  }

  const due = Number(body.due_day);
  if (!Number.isInteger(due) || due < 1 || due > 31) {
    throw httpError(400, '扣款日须为 1–31', 'VALIDATION_ERROR');
  }

  let note = body.note;
  if (note == null || note === '') note = null;
  else {
    note = String(note);
    if (note.length > 500) throw httpError(400, '备注过长', 'VALIDATION_ERROR');
  }

  return {
    title,
    category,
    expected_amount_fen,
    due_day: due,
    auto_pay: body.auto_pay ? 1 : 0,
    enabled: body.enabled === undefined ? 1 : body.enabled ? 1 : 0,
    note,
  };
}

function shapeItem(row) {
  return {
    id: Number(row.id),
    title: row.title,
    category: row.category,
    expected_amount_fen: Number(row.expected_amount_fen),
    due_day: Number(row.due_day),
    auto_pay: !!Number(row.auto_pay),
    enabled: !!Number(row.enabled),
    note: row.note,
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** 模板 + 该月记录 → 界面要的一条 */
function shapeMonthItem(row, month) {
  const expected = Number(row.expected_amount_fen);
  const hasRecord = row.record_id != null;
  const amount = hasRecord ? Number(row.record_amount_fen) : expected;
  return {
    ...shapeItem(row),
    month,
    due_date: dueDateOf(month, row.due_day),
    amount_fen: amount,
    overridden: hasRecord && amount !== expected,
    record_id: hasRecord ? Number(row.record_id) : null,
    paid: hasRecord ? !!Number(row.record_paid) : false,
    paid_date: row.record_paid_date
      ? String(row.record_paid_date).slice(0, 10)
      : null,
    record_note: row.record_note ?? null,
  };
}

const MONTH_SELECT = `
  SELECT t.*,
         r.id           AS record_id,
         r.amount_fen   AS record_amount_fen,
         r.paid         AS record_paid,
         r.paid_date    AS record_paid_date,
         r.note         AS record_note
  FROM fixed_expenses t
  LEFT JOIN fixed_expense_records r
    ON r.fixed_expense_id = t.id
   AND r.billing_month = ?
  WHERE t.user_id = ?
`;

const MONTH_ORDER = ' ORDER BY t.sort_order ASC, t.id ASC';

async function loadItems(uid, month) {
  const rows = await query(`${MONTH_SELECT}${MONTH_ORDER}`, [month, uid]);
  return rows.map((r) => shapeMonthItem(r, month));
}

function summarize(items) {
  const live = items.filter((x) => x.enabled);
  const total = live.reduce((s, x) => s + x.amount_fen, 0);
  const paid = live.reduce((s, x) => s + (x.paid ? x.amount_fen : 0), 0);
  const yearly = live.reduce((s, x) => s + x.expected_amount_fen * 12, 0);
  return {
    total_fen: total,
    paid_fen: paid,
    unpaid_fen: total - paid,
    yearly_fen: yearly,
    item_count: live.length,
    paid_count: live.filter((x) => x.paid).length,
  };
}

async function fetchItemRow(uid, id, month) {
  const rows = await query(`${MONTH_SELECT} AND t.id = ?${MONTH_ORDER}`, [
    month,
    uid,
    id,
  ]);
  if (!rows.length) {
    throw httpError(404, '固定支出不存在', 'FIXED_EXPENSE_NOT_FOUND');
  }
  return rows[0];
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const { enabled, q, month } = req.query;
    let sql = 'SELECT * FROM fixed_expenses WHERE user_id = ?';
    const params = [uid];
    if (enabled === '1' || enabled === '0') {
      sql += ' AND enabled = ?';
      params.push(Number(enabled));
    }
    if (q && String(q).trim()) {
      sql += ' AND title LIKE ?';
      params.push(`%${String(q).trim()}%`);
    }
    sql += ' ORDER BY sort_order ASC, id ASC';
    const rows = await query(sql, params);
    const list = rows.slice(0, MAX_ITEMS).map(shapeItem);
    const payload = { list };
    if (month) {
      const m = requireMonth(month);
      const items = await loadItems(uid, m);
      payload.month = m;
      payload.summary = summarize(items);
    }
    res.json({ success: true, data: payload });
  })
);

router.get(
  '/month',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const month = requireMonth(req.query.month || currentMonth());
    const items = await loadItems(uid, month);
    res.json({
      success: true,
      data: { month, items, summary: summarize(items) },
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const count = await query(
      'SELECT COUNT(*) AS n FROM fixed_expenses WHERE user_id = ?',
      [uid]
    );
    if (Number(count[0].n) >= MAX_ITEMS) {
      throw httpError(400, `固定支出最多 ${MAX_ITEMS} 条`, 'TOO_MANY_ITEMS');
    }
    const body = parseItemBody(req.body || {});
    const next = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM fixed_expenses WHERE user_id = ?',
      [uid]
    );
    const result = await query(
      `INSERT INTO fixed_expenses
        (user_id, title, category, expected_amount_fen, due_day, auto_pay, enabled, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        body.title,
        body.category,
        body.expected_amount_fen,
        body.due_day,
        body.auto_pay,
        body.enabled,
        body.note,
        Number(next[0].n),
      ]
    );
    const rows = await query('SELECT * FROM fixed_expenses WHERE id = ?', [
      result.insertId,
    ]);
    res.status(201).json({ success: true, data: shapeItem(rows[0]) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const existing = await query(
      'SELECT id FROM fixed_expenses WHERE id = ? AND user_id = ?',
      [req.params.id, uid]
    );
    if (!existing.length) {
      throw httpError(404, '固定支出不存在', 'FIXED_EXPENSE_NOT_FOUND');
    }
    const body = parseItemBody(req.body || {});
    await query(
      `UPDATE fixed_expenses
       SET title = ?, category = ?, expected_amount_fen = ?, due_day = ?,
           auto_pay = ?, enabled = ?, note = ?
       WHERE id = ? AND user_id = ?`,
      [
        body.title,
        body.category,
        body.expected_amount_fen,
        body.due_day,
        body.auto_pay,
        body.enabled,
        body.note,
        req.params.id,
        uid,
      ]
    );
    const rows = await query(
      'SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?',
      [req.params.id, uid]
    );
    res.json({ success: true, data: shapeItem(rows[0]) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const existing = await query(
      'SELECT id FROM fixed_expenses WHERE id = ? AND user_id = ?',
      [req.params.id, uid]
    );
    if (!existing.length) {
      throw httpError(404, '固定支出不存在', 'FIXED_EXPENSE_NOT_FOUND');
    }
    await query('DELETE FROM fixed_expenses WHERE id = ? AND user_id = ?', [
      req.params.id,
      uid,
    ]);
    res.json({ success: true, data: { id: Number(req.params.id) } });
  })
);

/**
 * 记某个月的实际情况：改金额、标已付、或恢复成模板预计值。
 * body: { amount_fen?, paid?, note?, reset? }
 */
router.put(
  '/:id/month/:month',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const month = requireMonth(req.params.month, 'month');
    const body = req.body || {};

    const templateRows = await query(
      'SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?',
      [req.params.id, uid]
    );
    if (!templateRows.length) {
      throw httpError(404, '固定支出不存在', 'FIXED_EXPENSE_NOT_FOUND');
    }
    const template = templateRows[0];

    const recordRows = await query(
      `SELECT * FROM fixed_expense_records
       WHERE fixed_expense_id = ? AND billing_month = ? LIMIT 1`,
      [req.params.id, month]
    );
    const current = recordRows[0] || null;

    if (body.reset) {
      if (current) {
        await query('DELETE FROM fixed_expense_records WHERE id = ?', [
          current.id,
        ]);
      }
    } else {
      let amount;
      if (body.amount_fen === undefined) {
        amount = current
          ? Number(current.amount_fen)
          : Number(template.expected_amount_fen);
      } else {
        amount = parseAmountFen(body.amount_fen);
        if (amount == null) {
          throw httpError(400, '金额须为 1–1000000000 分', 'VALIDATION_ERROR');
        }
      }

      const paid =
        body.paid === undefined
          ? !!Number(current?.paid || 0)
          : Boolean(body.paid);

      let note = body.note === undefined ? current?.note ?? null : body.note;
      if (note == null || note === '') note = null;
      else {
        note = String(note);
        if (note.length > 500) throw httpError(400, '备注过长', 'VALIDATION_ERROR');
      }

      const today = shanghaiDateOf(new Date());
      const paidDate = paid ? current?.paid_date || today : null;

      await query(
        `INSERT INTO fixed_expense_records
           (user_id, fixed_expense_id, billing_month, amount_fen, paid, paid_date, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           amount_fen = VALUES(amount_fen),
           paid       = VALUES(paid),
           paid_date  = VALUES(paid_date),
           note       = VALUES(note)`,
        [uid, req.params.id, month, amount, paid ? 1 : 0, paidDate, note]
      );
    }

    const row = await fetchItemRow(uid, req.params.id, month);
    res.json({ success: true, data: shapeMonthItem(row, month) });
  })
);

module.exports = router;
