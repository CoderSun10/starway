-- FocusPlan MySQL 8.0 Schema
-- 所有时间字段统一存储 UTC（DATETIME），前端用 dayjs 转换显示

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS focusplan
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE focusplan;

-- 计划表
CREATE TABLE IF NOT EXISTS schedules (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200)    NOT NULL COMMENT '计划标题',
  description   TEXT            NULL COMMENT '计划描述',
  start_at      DATETIME        NOT NULL COMMENT '开始时间 UTC',
  end_at        DATETIME        NOT NULL COMMENT '结束时间 UTC（可跨天）',
  planned_minutes INT UNSIGNED  NOT NULL COMMENT '预计总工时（分钟）',
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schedules_start (start_at),
  INDEX idx_schedules_end (end_at),
  INDEX idx_schedules_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 任务表（属于某个计划）
CREATE TABLE IF NOT EXISTS tasks (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  schedule_id     BIGINT UNSIGNED NOT NULL,
  description        VARCHAR(500)    NOT NULL COMMENT '任务描述',
  planned_minutes    INT UNSIGNED    NOT NULL COMMENT '预计时长（分钟）',
  completed_percent  INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '用户主观设置的完成百分比(0-100)，计划进度取各任务平均值',
  sort_order         INT             NOT NULL DEFAULT 0 COMMENT '排序',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_schedule
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_tasks_schedule (schedule_id),
  INDEX idx_tasks_sort (schedule_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 番茄钟会话记录
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  schedule_id     BIGINT UNSIGNED NULL COMMENT '关联计划（可选）',
  task_id         BIGINT UNSIGNED NULL COMMENT '关联任务（可选）',
  content         VARCHAR(500)    NULL COMMENT '自由填写的专注内容',
  started_at      DATETIME        NOT NULL COMMENT '开始时间 UTC',
  ended_at        DATETIME        NOT NULL COMMENT '结束时间 UTC',
  duration_minutes INT UNSIGNED   NOT NULL COMMENT '实际时长（分钟）',
  planned_minutes  INT UNSIGNED   NULL COMMENT '本次设定的番茄时长',
  status          ENUM('completed', 'aborted') NOT NULL DEFAULT 'completed',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_schedule
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_sessions_task
    FOREIGN KEY (task_id) REFERENCES tasks(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_sessions_started (started_at),
  INDEX idx_sessions_ended (ended_at),
  INDEX idx_sessions_schedule (schedule_id),
  INDEX idx_sessions_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 客户端设置（时区偏好等）
CREATE TABLE IF NOT EXISTS app_settings (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  setting_key   VARCHAR(100) NOT NULL UNIQUE,
  setting_value VARCHAR(500) NOT NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('timezone_mode', 'Asia/Shanghai')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
