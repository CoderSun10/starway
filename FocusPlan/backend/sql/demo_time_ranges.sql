SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET CHARACTER SET utf8mb4;
USE focusplan;

-- ============================================================
-- 本地演示数据：覆盖 近7天 / 7~30天 / 超过30天
-- 参考「今天」= 2026-08-04（北京时间），库内时间为 UTC
-- 北京 2026-08-04 00:00 = UTC 2026-08-03 16:00
-- ============================================================

-- 清理仅本脚本会插入的演示计划（按标题前缀），避免重复执行堆数据
DELETE FROM pomodoro_sessions WHERE schedule_id IN (
  SELECT id FROM (
    SELECT id FROM schedules WHERE title LIKE '【演示】%'
  ) t
);
DELETE FROM tasks WHERE schedule_id IN (
  SELECT id FROM (
    SELECT id FROM schedules WHERE title LIKE '【演示】%'
  ) t
);
DELETE FROM schedules WHERE title LIKE '【演示】%';

-- ---------- A. 近 7 天内（应出现在 days=7 与 days=30）----------
INSERT INTO schedules (title, description, start_at, end_at, planned_minutes) VALUES
  ('【演示】本周晨读', '近7天：应在7天/30天饼图都出现', '2026-08-01 00:00:00', '2026-08-03 10:00:00', 120),
  ('【演示】本周项目冲刺', '近7天：主计划', '2026-08-02 01:00:00', '2026-08-04 12:00:00', 180);

SET @s_recent1 = (SELECT id FROM schedules WHERE title = '【演示】本周晨读' LIMIT 1);
SET @s_recent2 = (SELECT id FROM schedules WHERE title = '【演示】本周项目冲刺' LIMIT 1);

INSERT INTO tasks (schedule_id, description, planned_minutes, completed_percent, sort_order) VALUES
  (@s_recent1, '阅读章节', 60, 40, 0),
  (@s_recent1, '笔记整理', 60, 20, 1),
  (@s_recent2, '编码实现', 90, 50, 0),
  (@s_recent2, '联调测试', 90, 30, 1);

SET @t_r1 = (SELECT id FROM tasks WHERE schedule_id = @s_recent1 AND sort_order = 0 LIMIT 1);
SET @t_r2 = (SELECT id FROM tasks WHERE schedule_id = @s_recent2 AND sort_order = 0 LIMIT 1);

-- 会话：北京 8/1~8/3 附近 → UTC 约 7/31 16:00 ~ 8/3
INSERT INTO pomodoro_sessions
  (schedule_id, task_id, content, started_at, ended_at, duration_minutes, planned_minutes, status)
VALUES
  (@s_recent1, @t_r1, NULL, '2026-08-01 01:00:00', '2026-08-01 01:45:00', 45, 45, 'completed'),
  (@s_recent1, @t_r1, NULL, '2026-08-02 02:00:00', '2026-08-02 02:40:00', 40, 45, 'completed'),
  (@s_recent2, @t_r2, NULL, '2026-08-02 06:00:00', '2026-08-02 07:00:00', 60, 60, 'completed'),
  (@s_recent2, @t_r2, NULL, '2026-08-03 03:00:00', '2026-08-03 04:15:00', 75, 60, 'completed'),
  (@s_recent2, @t_r2, NULL, '2026-08-04 01:00:00', '2026-08-04 01:50:00', 50, 50, 'completed');

-- ---------- B. 7~30 天前（仅 days=30 应出现，days=7 不应计入）----------
INSERT INTO schedules (title, description, start_at, end_at, planned_minutes) VALUES
  ('【演示】两周前复习周', '7~30天：只在近30天饼图', '2026-07-15 00:00:00', '2026-07-20 12:00:00', 200),
  ('【演示】三周前论文', '7~30天：较大时长便于看饼图', '2026-07-10 02:00:00', '2026-07-14 10:00:00', 240);

SET @s_mid1 = (SELECT id FROM schedules WHERE title = '【演示】两周前复习周' LIMIT 1);
SET @s_mid2 = (SELECT id FROM schedules WHERE title = '【演示】三周前论文' LIMIT 1);

INSERT INTO tasks (schedule_id, description, planned_minutes, completed_percent, sort_order) VALUES
  (@s_mid1, '错题回顾', 100, 80, 0),
  (@s_mid1, '模拟卷', 100, 60, 1),
  (@s_mid2, '文献精读', 120, 70, 0),
  (@s_mid2, '实验复现', 120, 40, 1);

SET @t_m1 = (SELECT id FROM tasks WHERE schedule_id = @s_mid1 AND sort_order = 0 LIMIT 1);
SET @t_m2 = (SELECT id FROM tasks WHERE schedule_id = @s_mid2 AND sort_order = 0 LIMIT 1);

INSERT INTO pomodoro_sessions
  (schedule_id, task_id, content, started_at, ended_at, duration_minutes, planned_minutes, status)
VALUES
  (@s_mid1, @t_m1, NULL, '2026-07-16 01:00:00', '2026-07-16 02:30:00', 90, 90, 'completed'),
  (@s_mid1, @t_m1, NULL, '2026-07-18 03:00:00', '2026-07-18 04:20:00', 80, 80, 'completed'),
  (@s_mid1, @t_m1, NULL, '2026-07-19 05:00:00', '2026-07-19 06:00:00', 60, 60, 'completed'),
  (@s_mid2, @t_m2, NULL, '2026-07-11 02:00:00', '2026-07-11 04:00:00', 120, 120, 'completed'),
  (@s_mid2, @t_m2, NULL, '2026-07-12 01:00:00', '2026-07-12 02:40:00', 100, 100, 'completed'),
  (@s_mid2, @t_m2, NULL, '2026-07-13 04:00:00', '2026-07-13 05:30:00', 90, 90, 'completed');

-- ---------- C. 超过 30 天前（近7/近30 都不应出现）----------
INSERT INTO schedules (title, description, start_at, end_at, planned_minutes) VALUES
  ('【演示】六月旧项目', '超过30天：饼图近7/30都不应出现', '2026-06-20 00:00:00', '2026-06-28 12:00:00', 300),
  ('【演示】五月归档', '超过30天：超大时长，若出现说明过滤失效', '2026-05-10 00:00:00', '2026-05-18 12:00:00', 400);

SET @s_old1 = (SELECT id FROM schedules WHERE title = '【演示】六月旧项目' LIMIT 1);
SET @s_old2 = (SELECT id FROM schedules WHERE title = '【演示】五月归档' LIMIT 1);

INSERT INTO tasks (schedule_id, description, planned_minutes, completed_percent, sort_order) VALUES
  (@s_old1, '遗留功能', 150, 100, 0),
  (@s_old1, '文档补全', 150, 100, 1),
  (@s_old2, '归档整理', 200, 100, 0),
  (@s_old2, '复盘总结', 200, 100, 1);

SET @t_o1 = (SELECT id FROM tasks WHERE schedule_id = @s_old1 AND sort_order = 0 LIMIT 1);
SET @t_o2 = (SELECT id FROM tasks WHERE schedule_id = @s_old2 AND sort_order = 0 LIMIT 1);

INSERT INTO pomodoro_sessions
  (schedule_id, task_id, content, started_at, ended_at, duration_minutes, planned_minutes, status)
VALUES
  (@s_old1, @t_o1, NULL, '2026-06-21 01:00:00', '2026-06-21 04:00:00', 180, 180, 'completed'),
  (@s_old1, @t_o1, NULL, '2026-06-22 02:00:00', '2026-06-22 05:00:00', 180, 180, 'completed'),
  (@s_old1, @t_o1, NULL, '2026-06-25 01:00:00', '2026-06-25 03:00:00', 120, 120, 'completed'),
  (@s_old2, @t_o2, NULL, '2026-05-11 01:00:00', '2026-05-11 05:00:00', 240, 240, 'completed'),
  (@s_old2, @t_o2, NULL, '2026-05-12 02:00:00', '2026-05-12 06:00:00', 240, 240, 'completed'),
  (@s_old2, @t_o2, NULL, '2026-05-15 01:00:00', '2026-05-15 04:00:00', 180, 180, 'completed');

-- ---------- 额外：让「近30天」里计划数 >5，便于看到「其他」合并 ----------
INSERT INTO schedules (title, description, start_at, end_at, planned_minutes) VALUES
  ('【演示】七月碎片A', '用于凑满 Top5 之外的「其他」', '2026-07-22 00:00:00', '2026-07-23 08:00:00', 60),
  ('【演示】七月碎片B', '用于凑满 Top5 之外的「其他」', '2026-07-24 00:00:00', '2026-07-25 08:00:00', 50),
  ('【演示】七月碎片C', '用于凑满 Top5 之外的「其他」', '2026-07-26 00:00:00', '2026-07-27 08:00:00', 40);

SET @s_a = (SELECT id FROM schedules WHERE title = '【演示】七月碎片A' LIMIT 1);
SET @s_b = (SELECT id FROM schedules WHERE title = '【演示】七月碎片B' LIMIT 1);
SET @s_c = (SELECT id FROM schedules WHERE title = '【演示】七月碎片C' LIMIT 1);

INSERT INTO tasks (schedule_id, description, planned_minutes, completed_percent, sort_order) VALUES
  (@s_a, '碎片任务A', 60, 50, 0),
  (@s_b, '碎片任务B', 50, 50, 0),
  (@s_c, '碎片任务C', 40, 50, 0);

INSERT INTO pomodoro_sessions
  (schedule_id, task_id, content, started_at, ended_at, duration_minutes, planned_minutes, status)
VALUES
  (@s_a, (SELECT id FROM tasks WHERE schedule_id=@s_a LIMIT 1), NULL, '2026-07-22 02:00:00', '2026-07-22 02:35:00', 35, 35, 'completed'),
  (@s_b, (SELECT id FROM tasks WHERE schedule_id=@s_b LIMIT 1), NULL, '2026-07-24 03:00:00', '2026-07-24 03:30:00', 30, 30, 'completed'),
  (@s_c, (SELECT id FROM tasks WHERE schedule_id=@s_c LIMIT 1), NULL, '2026-07-26 04:00:00', '2026-07-26 04:25:00', 25, 25, 'completed');

SELECT 'OK demo data inserted' AS msg;
SELECT title, start_at FROM schedules WHERE title LIKE '【演示】%' ORDER BY start_at;