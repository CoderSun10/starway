const express = require('express');
const { query, withTransaction } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { userId } = require('../middleware/auth');

const router = express.Router();
const MAX_MINUTES = 100000;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function toMysqlDatetime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw httpError(400, `无效时间: ${value}`, 'INVALID_DATETIME');
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function parsePlans(raw, parentStart, parentEnd) {
  if (!Array.isArray(raw)) {
    throw httpError(400, '计划列表无效', 'VALIDATION_ERROR');
  }
  const p0 = new Date(parentStart).getTime();
  const p1 = new Date(parentEnd).getTime();
  return raw.map((p, index) => {
    const n = index + 1;
    const title = String(p?.title || '').trim();
    if (!title) throw httpError(400, `第 ${n} 个计划标题不能为空`, 'VALIDATION_ERROR');
    if (!p.start_at || !p.end_at) {
      throw httpError(400, `第 ${n} 个计划需要开始和结束时间`, 'VALIDATION_ERROR');
    }
    const startMs = new Date(p.start_at).getTime();
    const endMs = new Date(p.end_at).getTime();
    if (!(endMs > startMs)) {
      throw httpError(400, `第 ${n} 个计划的结束时间必须晚于开始时间`, 'VALIDATION_ERROR');
    }
    if (startMs < p0 || endMs > p1) {
      throw httpError(400, `「${title}」的时间必须落在项目之内`, 'VALIDATION_ERROR');
    }
    if (!Array.isArray(p.tasks) || p.tasks.length === 0) {
      throw httpError(400, `第 ${n} 个计划至少要有一个任务`, 'VALIDATION_ERROR');
    }
    const tasks = p.tasks.map((t, ti) => {
      const description = String(t?.description || '').trim();
      if (!description) {
        throw httpError(400, `第 ${n} 个计划的第 ${ti + 1} 个任务描述不能为空`, 'VALIDATION_ERROR');
      }
      const mins = Number(t.planned_minutes);
      if (!Number.isFinite(mins) || mins <= 0 || mins > MAX_MINUTES) {
        throw httpError(400, `第 ${n} 个计划的第 ${ti + 1} 个任务时长无效`, 'VALIDATION_ERROR');
      }
      const pctRaw = Number(t.completed_percent);
      return {
        id: t.id != null ? Number(t.id) : null,
        description,
        planned_minutes: mins,
        completed_percent: Number.isFinite(pctRaw)
          ? Math.min(100, Math.max(0, Math.round(pctRaw)))
          : 0,
        sort_order: ti,
      };
    });
    return {
      id: p.id != null ? Number(p.id) : null,
      title,
      description: p.description ? String(p.description).trim() : null,
      start_at: p.start_at,
      end_at: p.end_at,
      planned_minutes: tasks.reduce((s, t) => s + t.planned_minutes, 0),
      tasks,
    };
  });
}

async function upsertTasks(conn, scheduleId, tasks) {
  const [oldRows] = await conn.execute('SELECT id FROM tasks WHERE schedule_id = ?', [scheduleId]);
  const oldIds = new Set((oldRows || []).map((r) => Number(r.id)));
  const keepIds = [];
  for (const t of tasks) {
    if (t.id && oldIds.has(t.id)) {
      await conn.execute(
        `UPDATE tasks
         SET description = ?, planned_minutes = ?, sort_order = ?
         WHERE id = ? AND schedule_id = ?`,
        [t.description, t.planned_minutes, t.sort_order, t.id, scheduleId]
      );
      keepIds.push(t.id);
    } else {
      const [ins] = await conn.execute(
        `INSERT INTO tasks
           (schedule_id, description, planned_minutes, completed_percent, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [scheduleId, t.description, t.planned_minutes, t.completed_percent, t.sort_order]
      );
      keepIds.push(ins.insertId);
    }
  }
  if (keepIds.length) {
    const ph = keepIds.map(() => '?').join(',');
    await conn.execute(
      `DELETE FROM tasks WHERE schedule_id = ? AND id NOT IN (${ph})`,
      [scheduleId, ...keepIds]
    );
  }
}

async function loadGroup(uid, id) {
  const rows = await query(
    'SELECT * FROM schedules WHERE id = ? AND user_id = ? AND is_group = 1',
    [id, uid]
  );
  if (!rows.length) return null;
  const group = rows[0];
  const children = await query(
    `SELECT * FROM schedules
     WHERE parent_id = ? AND user_id = ? AND is_group = 0
     ORDER BY start_at ASC, id ASC`,
    [id, uid]
  );
  const ids = children.map((r) => r.id);
  const tasksBy = {};
  const focusBy = {};
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const tasks = await query(
      `SELECT * FROM tasks WHERE schedule_id IN (${ph}) ORDER BY sort_order ASC, id ASC`,
      ids
    );
    for (const t of tasks) {
      if (!tasksBy[t.schedule_id]) tasksBy[t.schedule_id] = [];
      tasksBy[t.schedule_id].push(t);
    }
    const focusRows = await query(
      `SELECT schedule_id,
              COALESCE(SUM(duration_minutes), 0) AS actual_focused_minutes,
              COUNT(*) AS session_count
       FROM pomodoro_sessions
       WHERE schedule_id IN (${ph}) AND status = 'completed'
       GROUP BY schedule_id`,
      ids
    );
    for (const f of focusRows) {
      focusBy[f.schedule_id] = {
        actual_focused_minutes: Number(f.actual_focused_minutes),
        session_count: Number(f.session_count),
      };
    }
  }
  const plans = children.map((s) => {
    const tasks = (tasksBy[s.id] || []).map((t) => ({
      ...t,
      completed_percent: Number(t.completed_percent || 0),
      planned_minutes: Number(t.planned_minutes),
    }));
    const percents = tasks.map((t) => t.completed_percent);
    const avg = percents.length
      ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
      : 0;
    return {
      ...s,
      is_group: 0,
      planned_minutes: Number(s.planned_minutes),
      tasks,
      progress_percent: avg,
      actual_focused_minutes: focusBy[s.id]?.actual_focused_minutes || 0,
      session_count: focusBy[s.id]?.session_count || 0,
    };
  });
  const allPercents = plans.flatMap((p) => p.tasks.map((t) => t.completed_percent));
  const progress = allPercents.length
    ? Math.round(allPercents.reduce((a, b) => a + b, 0) / allPercents.length)
    : 0;
  const focused = plans.reduce((s, p) => s + p.actual_focused_minutes, 0);
  return {
    ...group,
    is_group: 1,
    parent_id: null,
    planned_minutes: Number(group.planned_minutes),
    progress_percent: progress,
    actual_focused_minutes: focused,
    plans,
  };
}

function readParent(body) {
  const title = String(body?.title || '').trim();
  if (!title) throw httpError(400, '请填写项目标题', 'VALIDATION_ERROR');
  if (!body.start_at || !body.end_at) {
    throw httpError(400, '请填写项目的开始和结束时间', 'VALIDATION_ERROR');
  }
  if (!(new Date(body.end_at).getTime() > new Date(body.start_at).getTime())) {
    throw httpError(400, '项目的结束时间必须晚于开始时间', 'VALIDATION_ERROR');
  }
  const planned = Number(body.planned_minutes);
  if (!Number.isFinite(planned) || planned <= 0 || planned > MAX_MINUTES) {
    throw httpError(400, '预计总工时必须大于 0', 'VALIDATION_ERROR');
  }
  const plans = parsePlans(body.plans || [], body.start_at, body.end_at);
  const sum = plans.reduce((s, p) => s + p.planned_minutes, 0);
  if (plans.length && sum !== Math.round(planned)) {
    throw httpError(
      400,
      `计划时长之和(${sum})必须等于预计总工时(${planned})`,
      'TASK_MINUTES_MISMATCH'
    );
  }
  return {
    title,
    description: body.description ? String(body.description).trim() : null,
    start_at: body.start_at,
    end_at: body.end_at,
    planned_minutes: plans.length ? sum : Math.round(planned),
    plans,
  };
}

async function writeGroup(uid, groupId, parent) {
  return withTransaction(async (conn) => {
    const startMysql = toMysqlDatetime(parent.start_at);
    const endMysql = toMysqlDatetime(parent.end_at);
    let id = groupId;
    if (!id) {
      const [ins] = await conn.execute(
        `INSERT INTO schedules
           (user_id, parent_id, is_group, title, description, start_at, end_at, planned_minutes)
         VALUES (?, NULL, 1, ?, ?, ?, ?, ?)`,
        [uid, parent.title, parent.description, startMysql, endMysql, parent.planned_minutes]
      );
      id = ins.insertId;
    } else {
      const [own] = await conn.execute(
        'SELECT id FROM schedules WHERE id = ? AND user_id = ? AND is_group = 1',
        [id, uid]
      );
      if (!own.length) throw httpError(404, '项目不存在', 'SCHEDULE_NOT_FOUND');
      await conn.execute(
        `UPDATE schedules
         SET title = ?, description = ?, start_at = ?, end_at = ?, planned_minutes = ?
         WHERE id = ? AND user_id = ? AND is_group = 1`,
        [parent.title, parent.description, startMysql, endMysql, parent.planned_minutes, id, uid]
      );
    }

    const [ownedRows] = await conn.execute(
      'SELECT id FROM schedules WHERE parent_id = ? AND user_id = ? AND is_group = 0',
      [id, uid]
    );
    const ownedIds = new Set((ownedRows || []).map((r) => Number(r.id)));
    const keepIds = [];

    for (const p of parent.plans) {
      const childStart = toMysqlDatetime(p.start_at);
      const childEnd = toMysqlDatetime(p.end_at);
      let childId = p.id;
      if (childId) {
        if (!ownedIds.has(childId)) {
          throw httpError(404, '计划不存在', 'SCHEDULE_NOT_FOUND');
        }
        await conn.execute(
          `UPDATE schedules
           SET title = ?, description = ?, start_at = ?, end_at = ?, planned_minutes = ?, parent_id = ?, is_group = 0
           WHERE id = ? AND user_id = ?`,
          [p.title, p.description, childStart, childEnd, p.planned_minutes, id, childId, uid]
        );
      } else {
        const [ins] = await conn.execute(
          `INSERT INTO schedules
             (user_id, parent_id, is_group, title, description, start_at, end_at, planned_minutes)
           VALUES (?, ?, 0, ?, ?, ?, ?, ?)`,
          [uid, id, p.title, p.description, childStart, childEnd, p.planned_minutes]
        );
        childId = ins.insertId;
      }
      await upsertTasks(conn, childId, p.tasks);
      keepIds.push(childId);
    }

    const drop = [...ownedIds].filter((x) => !keepIds.includes(x));
    if (drop.length) {
      const ph = drop.map(() => '?').join(',');
      await conn.execute(
        `DELETE FROM schedules WHERE user_id = ? AND parent_id = ? AND id IN (${ph})`,
        [uid, id, ...drop]
      );
    }
    return id;
  });
}

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await loadGroup(userId(req), req.params.id);
    if (!data) throw httpError(404, '项目不存在', 'SCHEDULE_NOT_FOUND');
    res.json({ success: true, data });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const parent = readParent(req.body || {});
    const id = await writeGroup(uid, null, parent);
    res.status(201).json({ success: true, data: await loadGroup(uid, id) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const parent = readParent(req.body || {});
    const id = Number(req.params.id);
    await writeGroup(uid, id, parent);
    res.json({ success: true, data: await loadGroup(uid, id) });
  })
);

module.exports = router;
