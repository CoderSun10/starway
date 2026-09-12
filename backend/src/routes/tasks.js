const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { userId } = require('../middleware/auth');

const router = express.Router();

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

// GET /api/tasks?schedule_id=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { schedule_id } = req.query;
    const uid = userId(req);
    let sql = `SELECT t.* FROM tasks t
      INNER JOIN schedules s ON s.id = t.schedule_id
      WHERE s.user_id = ?`;
    const params = [uid];
    if (schedule_id) {
      sql += ' AND t.schedule_id = ?';
      params.push(schedule_id);
    }
    sql += ' ORDER BY t.sort_order ASC, t.id ASC';
    const rows = await query(sql, params);
    res.json({
      success: true,
      data: rows.map((t) => ({ ...t, planned_minutes: Number(t.planned_minutes) })),
    });
  })
);

// PATCH /api/tasks/:id — 更新单个任务（含完成度）
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { description, planned_minutes, sort_order, completed_percent } =
      req.body || {};
    const uid = userId(req);
    const rows = await query(
      `SELECT t.* FROM tasks t
       INNER JOIN schedules s ON s.id = t.schedule_id
       WHERE t.id = ? AND s.user_id = ?`,
      [req.params.id, uid]
    );
    if (!rows.length) throw httpError(404, '任务不存在', 'TASK_NOT_FOUND');

    const next = {
      description:
        description !== undefined ? String(description).trim() : rows[0].description,
      planned_minutes:
        planned_minutes !== undefined
          ? Number(planned_minutes)
          : Number(rows[0].planned_minutes),
      sort_order: sort_order !== undefined ? Number(sort_order) : rows[0].sort_order,
      completed_percent:
        completed_percent !== undefined
          ? Number(completed_percent)
          : Number(rows[0].completed_percent || 0),
    };

    if (!next.description) throw httpError(400, '任务描述不能为空', 'VALIDATION_ERROR');
    if (!Number.isFinite(next.planned_minutes) || next.planned_minutes <= 0) {
      throw httpError(400, '任务时长无效', 'VALIDATION_ERROR');
    }
    if (!Number.isFinite(next.completed_percent)) {
      throw httpError(400, '完成度无效', 'VALIDATION_ERROR');
    }
    next.completed_percent = Math.max(
      0,
      Math.min(100, Math.round(next.completed_percent))
    );

    await query(
      `UPDATE tasks
       SET description = ?, planned_minutes = ?, sort_order = ?, completed_percent = ?
       WHERE id = ?`,
      [
        next.description,
        next.planned_minutes,
        next.sort_order,
        next.completed_percent,
        req.params.id,
      ]
    );
    const updated = await query(
      `SELECT t.* FROM tasks t
       INNER JOIN schedules s ON s.id = t.schedule_id
       WHERE t.id = ? AND s.user_id = ?`,
      [req.params.id, uid]
    );
    res.json({
      success: true,
      data: {
        ...updated[0],
        planned_minutes: Number(updated[0].planned_minutes),
        completed_percent: Number(updated[0].completed_percent || 0),
      },
    });
  })
);

// DELETE /api/tasks/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await query(
      `DELETE t FROM tasks t
       INNER JOIN schedules s ON s.id = t.schedule_id
       WHERE t.id = ? AND s.user_id = ?`,
      [req.params.id, userId(req)]
    );
    if (result.affectedRows === 0) throw httpError(404, '任务不存在', 'TASK_NOT_FOUND');
    res.json({ success: true, message: '已删除' });
  })
);

module.exports = router;
