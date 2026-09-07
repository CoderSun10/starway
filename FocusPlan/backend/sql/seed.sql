-- 可选示例数据（UTC 时间）
-- 必须 SET NAMES：docker init 默认客户端可能是 latin1，否则中文会乱码
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET CHARACTER SET utf8mb4;

USE focusplan;

INSERT INTO schedules (id, title, description, start_at, end_at, planned_minutes)
VALUES
  (1, '深度学习冲刺日', '完成论文阅读与代码实验', '2026-07-18 01:00:00', '2026-07-18 10:00:00', 180),
  (2, '跨天项目攻坚', '跨日开发与联调', '2026-07-18 14:00:00', '2026-07-19 02:00:00', 240);

INSERT INTO tasks (schedule_id, description, planned_minutes, sort_order)
VALUES
  (1, '阅读相关论文', 60, 0),
  (1, '实现核心算法', 90, 1),
  (1, '整理实验笔记', 30, 2),
  (2, '后端接口联调', 120, 0),
  (2, '前端页面打磨', 90, 1),
  (2, '写测试与文档', 30, 2);

INSERT INTO pomodoro_sessions
  (schedule_id, task_id, content, started_at, ended_at, duration_minutes, planned_minutes, status)
VALUES
  (1, 1, NULL, '2026-07-18 01:05:00', '2026-07-18 01:30:00', 25, 25, 'completed'),
  (1, 2, NULL, '2026-07-18 02:00:00', '2026-07-18 02:50:00', 50, 50, 'completed'),
  (NULL, NULL, '自由阅读技术博客', '2026-07-17 03:00:00', '2026-07-17 03:25:00', 25, 25, 'completed');
