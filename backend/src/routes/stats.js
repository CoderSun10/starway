const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { userId } = require('../middleware/auth');
const {
  parseYmd,
  inclusiveDayCount,
  eachUtcDate,
} = require('../utils/timeLogic');

const router = express.Router();

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * 统计接口
 * 默认按 Asia/Shanghai 日历日聚合（CONVERT_TZ +08:00）
 * 可通过 ?tz=Asia/Shanghai 或 Local 模式用 dayStart 参数由前端传入
 */

// GET /api/stats/overview?today=YYYY-MM-DD
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const today = req.query.today; // 客户端时区下的今天 YYYY-MM-DD
    // 若未传，用上海时区今天
    const todayExpr = today
      ? '?'
      : 'DATE(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00"))';

    // 今日
    const todayRows = await query(
      `SELECT
         COALESCE(SUM(duration_minutes), 0) AS total_minutes,
         COUNT(*) AS pomodoro_count
       FROM pomodoro_sessions
       WHERE user_id = ? AND status = 'completed'
         AND DATE(CONVERT_TZ(started_at, "+00:00", "+08:00")) = ${todayExpr}`,
      today ? [uid, today] : [uid]
    );

    // 本周（周一至今天，上海）
    const weekRows = await query(
      `SELECT
         COALESCE(SUM(duration_minutes), 0) AS total_minutes,
         COUNT(*) AS pomodoro_count
       FROM pomodoro_sessions
       WHERE user_id = ? AND status = 'completed'
         AND DATE(CONVERT_TZ(started_at, "+00:00", "+08:00"))
             >= DATE_SUB(${todayExpr}, INTERVAL WEEKDAY(CONVERT_TZ(
                  ${today ? 'STR_TO_DATE(?, "%Y-%m-%d")' : 'UTC_TIMESTAMP()'},
                  ${today ? '"+08:00"' : '"+00:00"'},
                  "+08:00"
                )) DAY)
         AND DATE(CONVERT_TZ(started_at, "+00:00", "+08:00")) <= ${todayExpr}`,
      today ? [uid, today, today, today] : [uid]
    );

    // 本月
    const monthRows = await query(
      `SELECT
         COALESCE(SUM(duration_minutes), 0) AS total_minutes,
         COUNT(*) AS pomodoro_count
       FROM pomodoro_sessions
       WHERE user_id = ? AND status = 'completed'
         AND DATE_FORMAT(CONVERT_TZ(started_at, "+00:00", "+08:00"), "%Y-%m")
             = DATE_FORMAT(${today ? 'STR_TO_DATE(?, "%Y-%m-%d")' : 'CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00")'}, "%Y-%m")`,
      today ? [uid, today] : [uid]
    );

    // 昨日对比
    const yesterdayRows = await query(
      `SELECT COALESCE(SUM(duration_minutes), 0) AS total_minutes
       FROM pomodoro_sessions
       WHERE user_id = ? AND status = 'completed'
         AND DATE(CONVERT_TZ(started_at, "+00:00", "+08:00"))
             = DATE_SUB(${todayExpr}, INTERVAL 1 DAY)`,
      today ? [uid, today] : [uid]
    );

    // 上周同区间粗对比：上周一到上周日
    const lastWeekRows = await query(
      `SELECT COALESCE(SUM(duration_minutes), 0) AS total_minutes
       FROM pomodoro_sessions
       WHERE user_id = ? AND status = 'completed'
         AND DATE(CONVERT_TZ(started_at, "+00:00", "+08:00"))
             BETWEEN DATE_SUB(${todayExpr}, INTERVAL (WEEKDAY(
               ${today ? 'STR_TO_DATE(?, "%Y-%m-%d")' : 'CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00")'}
             ) + 7) DAY)
             AND DATE_SUB(${todayExpr}, INTERVAL (WEEKDAY(
               ${today ? 'STR_TO_DATE(?, "%Y-%m-%d")' : 'CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00")'}
             ) + 1) DAY)`,
      today ? [uid, today, today, today, today] : [uid]
    );

    const spendTodayExpr = today ? '?' : `DATE(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00"))`;
    const spendTodayRows = await query(
      `SELECT COALESCE(SUM(amount_fen), 0) AS total_fen
       FROM expense_entries
       WHERE user_id = ? AND occurred_date = ${spendTodayExpr}`,
      today ? [uid, today] : [uid]
    );
    const spendWeekRows = await query(
      `SELECT COALESCE(SUM(amount_fen), 0) AS total_fen
       FROM expense_entries
       WHERE user_id = ? AND occurred_date >= DATE_SUB(${spendTodayExpr}, INTERVAL WEEKDAY(STR_TO_DATE(${
         today ? '?' : 'DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00"), "%Y-%m-%d")'
       }, '%Y-%m-%d')) DAY)
         AND occurred_date <= ${spendTodayExpr}`,
      today ? [uid, today, today, today] : [uid]
    );
    const spendMonthRows = await query(
      `SELECT COALESCE(SUM(amount_fen), 0) AS total_fen
       FROM expense_entries
       WHERE user_id = ? AND DATE_FORMAT(occurred_date, "%Y-%m")
             = DATE_FORMAT(${
               today
                 ? 'STR_TO_DATE(?, "%Y-%m-%d")'
                 : 'CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00")'
             }, "%Y-%m")`,
      today ? [uid, today] : [uid]
    );
    const spendYesterdayRows = await query(
      `SELECT COALESCE(SUM(amount_fen), 0) AS total_fen
       FROM expense_entries
       WHERE user_id = ? AND occurred_date = DATE_SUB(${spendTodayExpr}, INTERVAL 1 DAY)`,
      today ? [uid, today] : [uid]
    );
    const spendLastWeekRows = await query(
      `SELECT COALESCE(SUM(amount_fen), 0) AS total_fen
       FROM expense_entries
       WHERE user_id = ? AND occurred_date BETWEEN DATE_SUB(${spendTodayExpr}, INTERVAL (WEEKDAY(
               STR_TO_DATE(${
                 today ? '?' : 'DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00"), "%Y-%m-%d")'
               }, '%Y-%m-%d')
             ) + 7) DAY)
             AND DATE_SUB(${spendTodayExpr}, INTERVAL (WEEKDAY(
               STR_TO_DATE(${
                 today ? '?' : 'DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00"), "%Y-%m-%d")'
               }, '%Y-%m-%d')
             ) + 1) DAY)`,
      today ? [uid, today, today, today, today] : [uid]
    );

    res.json({
      success: true,
      data: {
        today_minutes: Number(todayRows[0].total_minutes),
        today_pomodoros: Number(todayRows[0].pomodoro_count),
        week_minutes: Number(weekRows[0].total_minutes),
        week_pomodoros: Number(weekRows[0].pomodoro_count),
        month_minutes: Number(monthRows[0].total_minutes),
        month_pomodoros: Number(monthRows[0].pomodoro_count),
        yesterday_minutes: Number(yesterdayRows[0].total_minutes),
        last_week_minutes: Number(lastWeekRows[0].total_minutes),
        today_spend_fen: Number(spendTodayRows[0].total_fen),
        week_spend_fen: Number(spendWeekRows[0].total_fen),
        month_spend_fen: Number(spendMonthRows[0].total_fen),
        yesterday_spend_fen: Number(spendYesterdayRows[0].total_fen),
        last_week_spend_fen: Number(spendLastWeekRows[0].total_fen),
      },
    });
  })
);

// GET /api/stats/daily?days=7|30
router.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const today = req.query.today; // YYYY-MM-DD 上海/本地今天

    // 生成最近 N 天每天汇总
    const rows = await query(
      `SELECT
         DATE(CONVERT_TZ(started_at, "+00:00", "+08:00")) AS day,
         COALESCE(SUM(duration_minutes), 0) AS total_minutes,
         COUNT(*) AS pomodoro_count
       FROM pomodoro_sessions
       WHERE user_id = ? AND status = 'completed'
         AND DATE(CONVERT_TZ(started_at, "+00:00", "+08:00"))
             >= DATE_SUB(${today ? 'STR_TO_DATE(?, "%Y-%m-%d")' : 'DATE(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00"))'}, INTERVAL ? DAY)
         AND DATE(CONVERT_TZ(started_at, "+00:00", "+08:00"))
             <= ${today ? 'STR_TO_DATE(?, "%Y-%m-%d")' : 'DATE(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00"))'}
       GROUP BY day
       ORDER BY day ASC`,
      today ? [uid, today, days - 1, today] : [uid, days - 1]
    );

    // 补全缺失日期
    const spendRows = await query(
      `SELECT occurred_date AS day,
              COALESCE(SUM(amount_fen), 0) AS spend_fen,
              COUNT(*) AS expense_count
       FROM expense_entries
       WHERE user_id = ? AND occurred_date
             >= DATE_SUB(${today ? 'STR_TO_DATE(?, "%Y-%m-%d")' : 'DATE(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00"))'}, INTERVAL ? DAY)
         AND occurred_date
             <= ${today ? 'STR_TO_DATE(?, "%Y-%m-%d")' : 'DATE(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00"))'}
       GROUP BY occurred_date`,
      today ? [uid, today, days - 1, today] : [uid, days - 1]
    );

    const map = {};
    for (const r of rows) {
      const key = typeof r.day === 'string' ? r.day.slice(0, 10) : String(r.day).slice(0, 10);
      map[key] = {
        day: key,
        total_minutes: Number(r.total_minutes),
        pomodoro_count: Number(r.pomodoro_count),
        spend_fen: 0,
        expense_count: 0,
      };
    }
    for (const r of spendRows) {
      const key = typeof r.day === 'string' ? r.day.slice(0, 10) : String(r.day).slice(0, 10);
      if (!map[key]) {
        map[key] = {
          day: key,
          total_minutes: 0,
          pomodoro_count: 0,
          spend_fen: 0,
          expense_count: 0,
        };
      }
      map[key].spend_fen = Number(r.spend_fen);
      map[key].expense_count = Number(r.expense_count);
    }

    const end = today
      ? new Date(`${today}T00:00:00+08:00`)
      : new Date(
          new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })
        );
    // 用简单字符串推进更稳妥
    const result = [];
    const baseStr = today || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const [y, m, d] = baseStr.split('-').map(Number);
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - i);
      const key = dt.toISOString().slice(0, 10);
      result.push(
        map[key] || {
          day: key,
          total_minutes: 0,
          pomodoro_count: 0,
          spend_fen: 0,
          expense_count: 0,
        }
      );
    }

    res.json({ success: true, data: result });
  })
);

// GET /api/stats/day-summary?from=&to=
router.get(
  '/day-summary',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const from = parseYmd(req.query.from);
    const to = parseYmd(req.query.to);
    const span = from && to ? inclusiveDayCount(from, to) : null;
    if (!from || !to || span == null || span < 1 || span > 42) {
      throw httpError(400, 'from/to 须为合法日期且闭区间 1–42 天', 'VALIDATION_ERROR');
    }

    const focusRows = await query(
      `SELECT DATE(CONVERT_TZ(started_at, "+00:00", "+08:00")) AS day,
              COALESCE(SUM(duration_minutes), 0) AS focus_minutes,
              COUNT(*) AS session_count
       FROM pomodoro_sessions
       WHERE user_id = ? AND status = 'completed'
         AND DATE(CONVERT_TZ(started_at, "+00:00", "+08:00")) >= ?
         AND DATE(CONVERT_TZ(started_at, "+00:00", "+08:00")) <= ?
       GROUP BY day`,
      [uid, from, to]
    );
    const spendRows = await query(
      `SELECT occurred_date AS day,
              COALESCE(SUM(amount_fen), 0) AS spend_fen,
              COUNT(*) AS expense_count
       FROM expense_entries
       WHERE user_id = ? AND occurred_date >= ? AND occurred_date <= ?
       GROUP BY occurred_date`,
      [uid, from, to]
    );

    const map = {};
    for (const day of eachUtcDate(from, to)) {
      map[day] = {
        day,
        focus_minutes: 0,
        session_count: 0,
        spend_fen: 0,
        expense_count: 0,
      };
    }
    for (const r of focusRows) {
      const key = String(r.day).slice(0, 10);
      if (!map[key]) continue;
      map[key].focus_minutes = Number(r.focus_minutes);
      map[key].session_count = Number(r.session_count);
    }
    for (const r of spendRows) {
      const key = String(r.day).slice(0, 10);
      if (!map[key]) continue;
      map[key].spend_fen = Number(r.spend_fen);
      map[key].expense_count = Number(r.expense_count);
    }

    res.json({
      success: true,
      data: { from, to, days: eachUtcDate(from, to).map((d) => map[d]) },
    });
  })
);

// GET /api/stats/by-schedule?days=7|30&today=YYYY-MM-DD
// 仅统计近 N 天，避免历史计划无限堆进饼图
router.get(
  '/by-schedule',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const today = req.query.today; // YYYY-MM-DD

    const dayFilter = today
      ? `AND DATE(CONVERT_TZ(s.started_at, "+00:00", "+08:00"))
             >= DATE_SUB(STR_TO_DATE(?, "%Y-%m-%d"), INTERVAL ? DAY)
         AND DATE(CONVERT_TZ(s.started_at, "+00:00", "+08:00"))
             <= STR_TO_DATE(?, "%Y-%m-%d")`
      : `AND DATE(CONVERT_TZ(s.started_at, "+00:00", "+08:00"))
             >= DATE_SUB(DATE(CONVERT_TZ(UTC_TIMESTAMP(), "+00:00", "+08:00")), INTERVAL ? DAY)`;
    const params = today ? [uid, today, days - 1, today] : [uid, days - 1];

    const rows = await query(
      `SELECT
         s.schedule_id,
         sc.title AS schedule_title,
         COALESCE(SUM(s.duration_minutes), 0) AS total_minutes,
         COUNT(*) AS session_count
       FROM pomodoro_sessions s
       LEFT JOIN schedules sc ON sc.id = s.schedule_id
       WHERE s.user_id = ? AND s.status = 'completed' AND s.schedule_id IS NOT NULL
         ${dayFilter}
       GROUP BY s.schedule_id, sc.title
       ORDER BY total_minutes DESC`,
      params
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        schedule_id: r.schedule_id,
        schedule_title: r.schedule_title || '未知计划',
        total_minutes: Number(r.total_minutes),
        session_count: Number(r.session_count),
      })),
    });
  })
);

// GET /api/stats/by-task?schedule_id=
router.get(
  '/by-task',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const { schedule_id } = req.query;
    let sql = `
      SELECT
        s.task_id,
        t.description AS task_description,
        s.schedule_id,
        COALESCE(SUM(s.duration_minutes), 0) AS total_minutes,
        COUNT(*) AS session_count
      FROM pomodoro_sessions s
      LEFT JOIN tasks t ON t.id = s.task_id
      WHERE s.user_id = ? AND s.status = 'completed' AND s.task_id IS NOT NULL
    `;
    const params = [uid];
    if (schedule_id) {
      sql += ' AND s.schedule_id = ?';
      params.push(schedule_id);
    }
    sql += ' GROUP BY s.task_id, t.description, s.schedule_id ORDER BY total_minutes DESC';
    const rows = await query(sql, params);
    res.json({
      success: true,
      data: rows.map((r) => ({
        task_id: r.task_id,
        task_description: r.task_description || '未知任务',
        schedule_id: r.schedule_id,
        total_minutes: Number(r.total_minutes),
        session_count: Number(r.session_count),
      })),
    });
  })
);

// GET /api/stats/schedule/:id — 计划维度统计
router.get(
  '/schedule/:id',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const id = req.params.id;
    const schedules = await query(
      'SELECT * FROM schedules WHERE id = ? AND user_id = ?',
      [id, uid]
    );
    if (!schedules.length) {
      const err = new Error('计划不存在');
      err.status = 404;
      throw err;
    }
    const schedule = schedules[0];
    const tasks = await query(
      'SELECT * FROM tasks WHERE schedule_id = ? ORDER BY sort_order ASC',
      [id]
    );

    // 实际专注时长（时间统计）
    const sessionAgg = await query(
      `SELECT
         COALESCE(SUM(duration_minutes), 0) AS actual_focused_minutes,
         COUNT(*) AS session_count
       FROM pomodoro_sessions
       WHERE user_id = ? AND schedule_id = ? AND status = 'completed'`,
      [uid, id]
    );

    // 计划进度基于任务 completed_percent 平均
    const percents = tasks.map(t => Number(t.completed_percent || 0));
    const avgPercent = percents.length > 0 ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0;
    const effectiveFocused = Math.round(Number(schedule.planned_minutes) * (avgPercent / 100));

    res.json({
      success: true,
      data: {
        schedule: {
          ...schedule,
          planned_minutes: Number(schedule.planned_minutes),
        },
        planned_minutes: Number(schedule.planned_minutes),
        focused_minutes: effectiveFocused,
        actual_focused_minutes: Number(sessionAgg[0].actual_focused_minutes),
        session_count: Number(sessionAgg[0].session_count),
        progress_percent: avgPercent,
        tasks: tasks.map((t) => {
          const pct = Number(t.completed_percent || 0);
          return {
            ...t,
            completed_percent: pct,
            planned_minutes: Number(t.planned_minutes),
            // 进度条使用百分比折算值
            focused_minutes: Math.round(Number(t.planned_minutes) * (pct / 100)),
            session_count: 0, // 不再按任务统计会话数用于进度
          };
        }),
      },
    });
  })
);

module.exports = router;
