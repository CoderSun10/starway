const express = require('express');
const { query, withTransaction } = require('../db');
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
  // 接受 ISO 字符串，转为 'YYYY-MM-DD HH:mm:ss'
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw httpError(400, `无效时间: ${value}`, 'INVALID_DATETIME');
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function loadScheduleDetail(id) {
  const rows = await query('SELECT * FROM schedules WHERE id = ?', [id]);
  if (!rows.length) return null;
  const schedule = rows[0];
  const tasks = await query(
    'SELECT * FROM tasks WHERE schedule_id = ? ORDER BY sort_order ASC, id ASC',
    [id]
  );

  // 仍然统计实际专注时长（用于显示“实际专注多久”）
  const focus = await query(
    `SELECT
       COALESCE(SUM(duration_minutes), 0) AS focused_minutes,
       COUNT(*) AS session_count
     FROM pomodoro_sessions
     WHERE schedule_id = ? AND status = 'completed'`,
    [id]
  );

  // 计划进度 = 各任务 completed_percent 的平均值
  // 为了让进度条继续工作，我们把 focused_minutes 设为“按百分比折算的等效分钟”
  const taskPercents = tasks.map(t => Number(t.completed_percent || 0));
  const avgPercent = taskPercents.length > 0
    ? Math.round(taskPercents.reduce((a, b) => a + b, 0) / taskPercents.length)
    : 0;

  const effectiveFocused = Math.round(Number(schedule.planned_minutes) * (avgPercent / 100));

  return {
    ...schedule,
    planned_minutes: Number(schedule.planned_minutes),
    tasks: tasks.map((t) => {
      const pct = Number(t.completed_percent || 0);
      return {
        ...t,
        completed_percent: pct,
        planned_minutes: Number(t.planned_minutes),
        // 用百分比折算后的值喂给进度条（取代原来的纯时间累加）
        focused_minutes: Math.round(Number(t.planned_minutes) * (pct / 100)),
        // 保留原始时间统计，供需要时使用（可选）
        actual_focused_minutes: 0, // 下面会回填
      };
    }),
    focused_minutes: effectiveFocused,
    session_count: Number(focus[0].session_count),
    // 额外返回实际专注时长，方便前端区分显示
    actual_focused_minutes: Number(focus[0].focused_minutes),
    progress_percent: avgPercent,
  };
}

// GET /api/schedules?date=YYYY-MM-DD&q=keyword&tzOffsetMinutes=480
// date 为用户时区下的「日历日」，用 UTC 边界过滤跨天计划
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { date, q, from, to } = req.query;
    let sql = 'SELECT * FROM schedules WHERE 1=1';
    const params = [];

    if (date) {
      // 当天 00:00 ~ 次日 00:00（按客户端传入的 UTC 边界更准确）
      // 兼容：若只传 date，按 Asia/Shanghai 偏移 +08:00 换算
      const dayStartUtc = req.query.dayStartUtc;
      const dayEndUtc = req.query.dayEndUtc;
      if (dayStartUtc && dayEndUtc) {
        sql += ' AND start_at < ? AND end_at > ?';
        params.push(toMysqlDatetime(dayEndUtc), toMysqlDatetime(dayStartUtc));
      } else {
        // date=YYYY-MM-DD 按上海时区日边界
        const start = `${date} 00:00:00`;
        // 用区间重叠：计划时间段与该日有交集
        sql +=
          ' AND start_at < CONVERT_TZ(DATE_ADD(?, INTERVAL 1 DAY), "+08:00", "+00:00") AND end_at > CONVERT_TZ(?, "+08:00", "+00:00")';
        params.push(start, start);
      }
    }

    if (from) {
      sql += ' AND end_at >= ?';
      params.push(toMysqlDatetime(from));
    }
    if (to) {
      sql += ' AND start_at <= ?';
      params.push(toMysqlDatetime(to));
    }
    if (q) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like);
    }

    sql += ' ORDER BY start_at DESC';
    const rows = await query(sql, params);

    const ids = rows.map((r) => r.id);
    let tasksBySchedule = {};
    let focusBySchedule = {};

    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const tasks = await query(
        `SELECT * FROM tasks WHERE schedule_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`,
        ids
      );
      for (const t of tasks) {
        if (!tasksBySchedule[t.schedule_id]) tasksBySchedule[t.schedule_id] = [];
        const pct = Number(t.completed_percent || 0);
        tasksBySchedule[t.schedule_id].push({
          ...t,
          completed_percent: pct,
          planned_minutes: Number(t.planned_minutes),
          // 进度条用百分比换算值
          focused_minutes: Math.round(Number(t.planned_minutes) * (pct / 100)),
        });
      }

      // 仍然保留实际总专注时长统计（不影响进度）
      const focusRows = await query(
        `SELECT schedule_id,
                COALESCE(SUM(duration_minutes), 0) AS actual_focused_minutes,
                COUNT(*) AS session_count
         FROM pomodoro_sessions
         WHERE schedule_id IN (${placeholders}) AND status = 'completed'
         GROUP BY schedule_id`,
        ids
      );
      for (const f of focusRows) {
        focusBySchedule[f.schedule_id] = {
          actual_focused_minutes: Number(f.actual_focused_minutes),
          session_count: Number(f.session_count),
        };
      }
    }

    const data = rows.map((s) => {
      const scheduleTasks = tasksBySchedule[s.id] || [];
      const percents = scheduleTasks.map(t => t.completed_percent || 0);
      const avg = percents.length > 0 ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0;
      const effective = Math.round(Number(s.planned_minutes) * (avg / 100));

      return {
        ...s,
        planned_minutes: Number(s.planned_minutes),
        tasks: scheduleTasks,
        focused_minutes: effective,           // 用于计划进度条（平均百分比折算）
        actual_focused_minutes: focusBySchedule[s.id]?.actual_focused_minutes || 0,
        session_count: focusBySchedule[s.id]?.session_count || 0,
        progress_percent: avg,
      };
    });

    res.json({ success: true, data });
  })
);

// GET /api/schedules/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const detail = await loadScheduleDetail(req.params.id);
    if (!detail) throw httpError(404, '计划不存在', 'SCHEDULE_NOT_FOUND');
    res.json({ success: true, data: detail });
  })
);

// POST /api/schedules
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, description, start_at, end_at, planned_minutes, tasks } = req.body || {};

    if (!title || !String(title).trim()) {
      throw httpError(400, '计划标题不能为空', 'VALIDATION_ERROR');
    }
    if (!start_at || !end_at) {
      throw httpError(400, '开始/结束时间必填', 'VALIDATION_ERROR');
    }
    const planned = Number(planned_minutes);
    if (!Number.isFinite(planned) || planned <= 0) {
      throw httpError(400, '预计总工时必须大于 0', 'VALIDATION_ERROR');
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw httpError(400, '至少添加一个任务', 'VALIDATION_ERROR');
    }

    const taskSum = tasks.reduce((sum, t) => sum + Number(t.planned_minutes || 0), 0);
    if (taskSum !== planned) {
      throw httpError(
        400,
        `任务时长之和(${taskSum})必须等于预计总工时(${planned})`,
        'TASK_MINUTES_MISMATCH'
      );
    }

    const startMysql = toMysqlDatetime(start_at);
    const endMysql = toMysqlDatetime(end_at);
    if (new Date(end_at).getTime() <= new Date(start_at).getTime()) {
      throw httpError(400, '结束时间必须晚于开始时间', 'VALIDATION_ERROR');
    }

    const id = await withTransaction(async (conn) => {
      const [result] = await conn.execute(
        `INSERT INTO schedules (title, description, start_at, end_at, planned_minutes)
         VALUES (?, ?, ?, ?, ?)`,
        [String(title).trim(), description || null, startMysql, endMysql, planned]
      );
      const scheduleId = result.insertId;
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        if (!t.description || !String(t.description).trim()) {
          throw httpError(400, `第 ${i + 1} 个任务描述不能为空`, 'VALIDATION_ERROR');
        }
        const mins = Number(t.planned_minutes);
        if (!Number.isFinite(mins) || mins <= 0) {
          throw httpError(400, `第 ${i + 1} 个任务时长无效`, 'VALIDATION_ERROR');
        }
        await conn.execute(
          `INSERT INTO tasks (schedule_id, description, planned_minutes, sort_order)
           VALUES (?, ?, ?, ?)`,
          [scheduleId, String(t.description).trim(), mins, Number(t.sort_order ?? i)]
        );
      }
      return scheduleId;
    });

    const detail = await loadScheduleDetail(id);
    res.status(201).json({ success: true, data: detail });
  })
);

// PUT /api/schedules/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await query('SELECT id FROM schedules WHERE id = ?', [id]);
    if (!existing.length) throw httpError(404, '计划不存在', 'SCHEDULE_NOT_FOUND');

    const { title, description, start_at, end_at, planned_minutes, tasks } = req.body || {};

    if (!title || !String(title).trim()) {
      throw httpError(400, '计划标题不能为空', 'VALIDATION_ERROR');
    }
    const planned = Number(planned_minutes);
    if (!Number.isFinite(planned) || planned <= 0) {
      throw httpError(400, '预计总工时必须大于 0', 'VALIDATION_ERROR');
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw httpError(400, '至少添加一个任务', 'VALIDATION_ERROR');
    }
    const taskSum = tasks.reduce((sum, t) => sum + Number(t.planned_minutes || 0), 0);
    if (taskSum !== planned) {
      throw httpError(
        400,
        `任务时长之和(${taskSum})必须等于预计总工时(${planned})`,
        'TASK_MINUTES_MISMATCH'
      );
    }
    if (new Date(end_at).getTime() <= new Date(start_at).getTime()) {
      throw httpError(400, '结束时间必须晚于开始时间', 'VALIDATION_ERROR');
    }

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE schedules
         SET title = ?, description = ?, start_at = ?, end_at = ?, planned_minutes = ?
         WHERE id = ?`,
        [
          String(title).trim(),
          description || null,
          toMysqlDatetime(start_at),
          toMysqlDatetime(end_at),
          planned,
          id,
        ]
      );

      // 按 id 更新任务，保留 completed_percent 与会话关联；勿整表删重建
      const [oldRows] = await conn.execute(
        'SELECT id, completed_percent FROM tasks WHERE schedule_id = ?',
        [id]
      );
      const oldById = new Map(
        (oldRows || []).map((r) => [Number(r.id), Number(r.completed_percent || 0)])
      );
      const keepIds = [];

      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        if (!t.description || !String(t.description).trim()) {
          throw httpError(400, `第 ${i + 1} 个任务描述不能为空`, 'VALIDATION_ERROR');
        }
        const mins = Number(t.planned_minutes);
        if (!Number.isFinite(mins) || mins <= 0) {
          throw httpError(400, `第 ${i + 1} 个任务时长无效`, 'VALIDATION_ERROR');
        }
        const sortOrder = Number(t.sort_order ?? i);
        const desc = String(t.description).trim();
        const taskId = t.id != null ? Number(t.id) : null;

        if (taskId && oldById.has(taskId)) {
          // 已有任务：只改描述/时长/排序，进度与历史记录保留
          await conn.execute(
            `UPDATE tasks
             SET description = ?, planned_minutes = ?, sort_order = ?
             WHERE id = ? AND schedule_id = ?`,
            [desc, mins, sortOrder, taskId, id]
          );
          keepIds.push(taskId);
        } else {
          const pctRaw = Number(t.completed_percent);
          const pct = Number.isFinite(pctRaw)
            ? Math.min(100, Math.max(0, Math.round(pctRaw)))
            : 0;
          const [ins] = await conn.execute(
            `INSERT INTO tasks
               (schedule_id, description, planned_minutes, completed_percent, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
            [id, desc, mins, pct, sortOrder]
          );
          keepIds.push(ins.insertId);
        }
      }

      // 仅删除表单里已去掉的任务（ON DELETE SET NULL 会解绑会话 task_id）
      if (keepIds.length) {
        const placeholders = keepIds.map(() => '?').join(',');
        await conn.execute(
          `DELETE FROM tasks WHERE schedule_id = ? AND id NOT IN (${placeholders})`,
          [id, ...keepIds]
        );
      } else {
        await conn.execute('DELETE FROM tasks WHERE schedule_id = ?', [id]);
      }
    });

    const detail = await loadScheduleDetail(id);
    res.json({ success: true, data: detail });
  })
);

// DELETE /api/schedules/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await query('DELETE FROM schedules WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      throw httpError(404, '计划不存在', 'SCHEDULE_NOT_FOUND');
    }
    res.json({ success: true, message: '已删除' });
  })
);

module.exports = router;
