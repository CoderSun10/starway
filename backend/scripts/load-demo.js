/**
 * 写入展示用假数据：覆盖日历明细 / 计划着色 / 热力图 / 统计 / 账本。
 * 用法（仓库根目录或 backend/）：node scripts/load-demo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/db');

function bj(y, m, d, hh = 0, mm = 0) {
  const utc = Date.UTC(y, m - 1, d, hh - 8, mm, 0);
  return new Date(utc).toISOString().slice(0, 19).replace('T', ' ');
}

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    await conn.query('TRUNCATE TABLE pomodoro_sessions');
    await conn.query('TRUNCATE TABLE tasks');
    await conn.query('TRUNCATE TABLE schedules');
    await conn.query('TRUNCATE TABLE expense_entries');
    await conn.query('TRUNCATE TABLE budget_periods');
    await conn.query('SET FOREIGN_KEY_CHECKS=1');

    const schedules = [
      {
        id: 1,
        title: '九月开篇：论文精读周',
        description: '把积压的论文过一遍，跨多个工作日',
        start: bj(2026, 9, 1, 9, 0),
        end: bj(2026, 9, 5, 18, 0),
        minutes: 600,
        tasks: [
          ['精读两篇顶会论文', 180, 80],
          ['整理笔记与引用', 120, 60],
          ['实验复现环境', 180, 40],
          ['周报小结', 120, 20],
        ],
      },
      {
        id: 2,
        title: '工作日冲刺 · 第一周',
        description: '产品主路径开发',
        start: bj(2026, 9, 7, 9, 0),
        end: bj(2026, 9, 11, 18, 0),
        minutes: 900,
        tasks: [
          ['日历与账本联调', 300, 70],
          ['热力图与着色', 240, 50],
          ['桌面端交互打磨', 240, 30],
          ['自测与修边', 120, 10],
        ],
      },
      {
        id: 3,
        title: '跨天联调夜',
        description: '从晚上做到次日凌晨，展示跨天计划',
        start: bj(2026, 9, 10, 21, 0),
        end: bj(2026, 9, 11, 2, 0),
        minutes: 240,
        tasks: [
          ['后端接口排查', 120, 90],
          ['前端对时区', 90, 70],
          ['写交接说明', 30, 40],
        ],
      },
      {
        id: 11,
        title: '八月收尾（上月痕迹）',
        description: '让八月格子也有计划色',
        start: bj(2026, 8, 26, 9, 0),
        end: bj(2026, 8, 31, 18, 0),
        minutes: 420,
        tasks: [
          ['八月总结', 120, 100],
          ['迁移待办', 180, 90],
          ['备份资料', 120, 100],
        ],
      },
    ];

    for (const s of schedules) {
      await conn.query(
        `INSERT INTO schedules (id, title, description, start_at, end_at, planned_minutes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.id, s.title, s.description, s.start, s.end, s.minutes]
      );
      for (let i = 0; i < s.tasks.length; i += 1) {
        const [desc, mins, pct] = s.tasks[i];
        await conn.query(
          `INSERT INTO tasks (schedule_id, description, planned_minutes, completed_percent, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [s.id, desc, mins, pct, i]
        );
      }
    }

    const [taskRows] = await conn.query(
      'SELECT id, schedule_id, sort_order FROM tasks ORDER BY schedule_id, sort_order'
    );
    const taskBy = {};
    for (const r of taskRows) {
      if (!taskBy[r.schedule_id]) taskBy[r.schedule_id] = [];
      taskBy[r.schedule_id].push(r.id);
    }

    const sessions = [];
    function addSess(day, hh, dur, planned, scheduleId, taskIndex, content) {
      const start = bj(2026, 9, day, hh, 0);
      const endH = hh + Math.floor(dur / 60);
      const endM = dur % 60;
      const end = bj(2026, 9, day, endH, endM);
      const taskId =
        scheduleId && taskBy[scheduleId] && taskIndex != null
          ? taskBy[scheduleId][taskIndex]
          : null;
      sessions.push([
        scheduleId,
        taskId,
        content,
        start,
        end,
        dur,
        planned,
        'completed',
      ]);
    }

    // 热力：工作日深、周末浅、有几天特别高
    const weekdayBlocks = {
      1: [[9, 50, 1, 0], [14, 45, 1, 2]],
      2: [[9, 90, 1, 2], [15, 25, null, null, '自由阅读']],
      3: [[8, 45, 1, 1], [13, 60, 1, 0], [20, 25, null, null, '晚间整理']],
      4: [[9, 120, 1, 2], [16, 45, 1, 3]],
      5: [[10, 75, 1, 0], [15, 30, null, null, '周复盘草稿']],
      7: [[9, 45, 2, 0], [14, 90, 2, 1]],
      8: [[9, 60, 2, 0], [13, 45, 2, 1], [20, 25, 2, 3, null]],
      9: [[8, 90, 2, 1], [14, 50, 2, 2]],
      10: [[9, 45, 2, 0], [15, 60, 2, 2], [21, 50, 3, 0]],
      11: [[0, 40, 3, 1], [9, 90, 2, 0], [14, 45, 2, 3]],
    };

    for (const [dayStr, blocks] of Object.entries(weekdayBlocks)) {
      const day = Number(dayStr);
      for (const b of blocks) {
        const [hh, dur, sid, tIdx, content] = b;
        addSess(day, hh, dur, dur, sid || null, tIdx, content || null);
      }
    }

    // 八月收尾几天
    sessions.push([
      11,
      taskBy[11][0],
      null,
      bj(2026, 8, 28, 9, 0),
      bj(2026, 8, 28, 10, 30),
      90,
      90,
      'completed',
    ]);
    sessions.push([
      11,
      taskBy[11][1],
      null,
      bj(2026, 8, 30, 14, 0),
      bj(2026, 8, 30, 16, 0),
      120,
      120,
      'completed',
    ]);
    sessions.push([
      null,
      null,
      '自由写作被打断',
      bj(2026, 9, 8, 21, 0),
      bj(2026, 9, 8, 21, 8),
      8,
      25,
      'aborted',
    ]);

    for (const row of sessions) {
      await conn.query(
        `INSERT INTO pomodoro_sessions
          (schedule_id, task_id, content, started_at, ended_at, duration_minutes, planned_minutes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row
      );
    }

    const budgets = [
      [1, '九月生活费', '本月日常预算（从 1 号开始）', '2026-09-01', '2026-09-30', 300000],
      [2, '第一周餐饮', '9/1–9/7', '2026-09-01', '2026-09-07', 80000],
      [3, '通勤周卡', '本周截至今天', '2026-09-08', '2026-09-11', 18000],
      [4, '学习资料', '书和课程', '2026-09-01', '2026-09-30', 50000],
      [5, '八月尾巴', '上月', '2026-08-25', '2026-08-31', 60000],
    ];
    for (const b of budgets) {
      await conn.query(
        `INSERT INTO budget_periods (id, title, description, start_date, end_date, planned_amount_fen)
         VALUES (?, ?, ?, ?, ?, ?)`,
        b
      );
    }

    const expenses = [];

    function exp(day, title, fen, note) {
      expenses.push([ymd(2026, 9, day), title, fen, note]);
    }

    for (let d = 1; d <= 11; d += 1) {
      exp(d, '午餐', 2800 + (d % 5) * 400, '工作日简餐');
      if (d % 2 === 1) exp(d, '咖啡', 1800, '美式');
      if (d <= 7) exp(d, '地铁', 600, '通勤');
      if (d >= 8 && d <= 11) exp(d, '地铁', 600, '通勤');
    }
    exp(3, '超市', 8600, '周采购');
    exp(5, '书籍', 12800, '技术书两本');
    exp(6, '晚餐', 9600, '周末聚餐');
    exp(7, '电影', 4500, null);
    exp(8, '午餐', 3200, '公司附近');
    exp(9, '下午茶', 2200, null);
    exp(10, '晚餐', 5800, '加班外卖');
    exp(10, '打车', 4200, '加班回家');
    exp(11, '早餐', 1500, null);
    exp(11, '午餐', 3600, null);

    expenses.push(['2026-08-28', '八月晚餐', 6200, '收尾']);
    expenses.push(['2026-08-30', '八月超市', 7700, null]);

    for (const e of expenses) {
      await conn.query(
        `INSERT INTO expense_entries (occurred_date, title, amount_fen, note)
         VALUES (?, ?, ?, ?)`,
        e
      );
    }

    const [[sc]] = await conn.query('SELECT COUNT(*) n FROM schedules');
    const [[tk]] = await conn.query('SELECT COUNT(*) n FROM tasks');
    const [[ss]] = await conn.query('SELECT COUNT(*) n FROM pomodoro_sessions');
    const [[bp]] = await conn.query('SELECT COUNT(*) n FROM budget_periods');
    const [[ex]] = await conn.query('SELECT COUNT(*) n FROM expense_entries');
    console.log(
      `demo loaded: schedules=${sc.n} tasks=${tk.n} sessions=${ss.n} budgets=${bp.n} expenses=${ex.n}`
    );
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
