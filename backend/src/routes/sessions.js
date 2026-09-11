const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function toMysqlDatetime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw httpError(400, `无效时间: ${value}`, 'INVALID_DATETIME');
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// GET /api/sessions?date=&schedule_id=&from=&to=&limit=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { date, schedule_id, from, to, limit = 100, offset = 0 } = req.query;
    let where = ' WHERE 1=1';
    const params = [];

    if (schedule_id) {
      where += ' AND s.schedule_id = ?';
      params.push(schedule_id);
    }
    if (date) {
      where +=
        ' AND DATE(CONVERT_TZ(s.started_at, "+00:00", "+08:00")) = ?';
      params.push(date);
    }
    if (from) {
      where += ' AND s.started_at >= ?';
      params.push(toMysqlDatetime(from));
    }
    if (to) {
      where += ' AND s.started_at <= ?';
      params.push(toMysqlDatetime(to));
    }

    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    const countRows = await query(
      `SELECT COUNT(*) AS n FROM pomodoro_sessions s${where}`,
      params
    );
    const sql = `
      SELECT s.*,
             sc.title AS schedule_title,
             t.description AS task_description
      FROM pomodoro_sessions s
      LEFT JOIN schedules sc ON sc.id = s.schedule_id
      LEFT JOIN tasks t ON t.id = s.task_id
      ${where}
      ORDER BY s.started_at DESC
      LIMIT ${lim} OFFSET ${off}
    `;

    const rows = await query(sql, params);
    res.json({
      success: true,
      total: Number(countRows[0]?.n || 0),
      data: rows.map((r) => ({
        ...r,
        duration_minutes: Number(r.duration_minutes),
        planned_minutes: r.planned_minutes != null ? Number(r.planned_minutes) : null,
      })),
    });
  })
);

// GET /api/sessions/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT s.*,
              sc.title AS schedule_title,
              t.description AS task_description
       FROM pomodoro_sessions s
       LEFT JOIN schedules sc ON sc.id = s.schedule_id
       LEFT JOIN tasks t ON t.id = s.task_id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) throw httpError(404, '会话不存在', 'SESSION_NOT_FOUND');
    const r = rows[0];
    res.json({
      success: true,
      data: {
        ...r,
        duration_minutes: Number(r.duration_minutes),
        planned_minutes: r.planned_minutes != null ? Number(r.planned_minutes) : null,
      },
    });
  })
);

// POST /api/sessions
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      schedule_id,
      task_id,
      content,
      started_at,
      ended_at,
      duration_minutes,
      planned_minutes,
      status = 'completed',
    } = req.body || {};

    if (!started_at || !ended_at) {
      throw httpError(400, '开始/结束时间必填', 'VALIDATION_ERROR');
    }

    let duration = Number(duration_minutes);
    if (!Number.isFinite(duration) || duration < 0) {
      const ms = new Date(ended_at).getTime() - new Date(started_at).getTime();
      duration = Math.max(1, Math.round(ms / 60000));
    }
    if (duration <= 0) {
      throw httpError(400, '专注时长必须大于 0', 'VALIDATION_ERROR');
    }

    if (schedule_id) {
      const sc = await query('SELECT id FROM schedules WHERE id = ?', [schedule_id]);
      if (!sc.length) throw httpError(400, '关联计划不存在', 'SCHEDULE_NOT_FOUND');
    }
    if (task_id) {
      const tk = await query('SELECT id, schedule_id FROM tasks WHERE id = ?', [task_id]);
      if (!tk.length) throw httpError(400, '关联任务不存在', 'TASK_NOT_FOUND');
      if (schedule_id && Number(tk[0].schedule_id) !== Number(schedule_id)) {
        throw httpError(400, '任务不属于该计划', 'TASK_SCHEDULE_MISMATCH');
      }
    }

    if (!schedule_id && !task_id && (!content || !String(content).trim())) {
      throw httpError(400, '请关联计划/任务或填写专注内容', 'VALIDATION_ERROR');
    }

    const [result] = await require('../db').pool.execute(
      `INSERT INTO pomodoro_sessions
        (schedule_id, task_id, content, started_at, ended_at, duration_minutes, planned_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule_id || null,
        task_id || null,
        content ? String(content).trim() : null,
        toMysqlDatetime(started_at),
        toMysqlDatetime(ended_at),
        duration,
        planned_minutes != null ? Number(planned_minutes) : null,
        status === 'aborted' ? 'aborted' : 'completed',
      ]
    );

    // 新逻辑：记录时可以对计划下的每个任务设置主观完成百分比
    // 前端传 task_progress_updates: [ { task_id, percent }, ... ]
    const updates = req.body.task_progress_updates;
    if (schedule_id && Array.isArray(updates) && updates.length > 0) {
      for (const u of updates) {
        const tid = Number(u.task_id);
        let pct = Number(u.percent);
        if (tid && Number.isFinite(pct)) {
          pct = Math.max(0, Math.min(100, Math.round(pct)));
          await query(
            'UPDATE tasks SET completed_percent = ? WHERE id = ? AND schedule_id = ?',
            [pct, tid, schedule_id]
          );
        }
      }
    }

    const rows = await query(
      `SELECT s.*,
              sc.title AS schedule_title,
              t.description AS task_description
       FROM pomodoro_sessions s
       LEFT JOIN schedules sc ON sc.id = s.schedule_id
       LEFT JOIN tasks t ON t.id = s.task_id
       WHERE s.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: {
        ...rows[0],
        duration_minutes: Number(rows[0].duration_minutes),
        planned_minutes:
          rows[0].planned_minutes != null ? Number(rows[0].planned_minutes) : null,
      },
    });
  })
);

// DELETE /api/sessions/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await query('DELETE FROM pomodoro_sessions WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) throw httpError(404, '会话不存在', 'SESSION_NOT_FOUND');
    res.json({ success: true, message: '已删除' });
  })
);

module.exports = router;
