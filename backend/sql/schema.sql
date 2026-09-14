-- FocusPlan MySQL 8.0 Schema
-- 所有时间字段统一存储 UTC（DATETIME），前端用 dayjs 转换显示

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS focusplan
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE focusplan;

-- 用户
CREATE TABLE IF NOT EXISTS users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(120)    NOT NULL,
  password_hash  VARCHAR(255)    NOT NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_codes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(120)    NOT NULL,
  purpose     ENUM('register','reset') NOT NULL,
  code_hash   VARCHAR(255)    NOT NULL,
  expires_at  DATETIME        NOT NULL,
  used_at     DATETIME        NULL,
  attempts    INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_codes_lookup (email, purpose, created_at),
  INDEX idx_email_codes_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 计划表
CREATE TABLE IF NOT EXISTS schedules (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NULL COMMENT '所属用户',
  title         VARCHAR(200)    NOT NULL COMMENT '计划标题',
  description   TEXT            NULL COMMENT '计划描述',
  start_at      DATETIME        NOT NULL COMMENT '开始时间 UTC',
  end_at        DATETIME        NOT NULL COMMENT '结束时间 UTC（可跨天）',
  planned_minutes INT UNSIGNED  NOT NULL COMMENT '预计总工时（分钟）',
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schedules_start (start_at),
  INDEX idx_schedules_end (end_at),
  INDEX idx_schedules_title (title),
  INDEX idx_schedules_user (user_id)
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
  user_id         BIGINT UNSIGNED NULL COMMENT '所属用户',
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
  INDEX idx_sessions_task (task_id),
  INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 客户端设置（时区偏好等）
CREATE TABLE IF NOT EXISTS app_settings (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NULL COMMENT '所属用户',
  setting_key   VARCHAR(100) NOT NULL,
  setting_value VARCHAR(500) NOT NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_settings_user_key (user_id, setting_key),
  INDEX idx_settings_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('timezone_mode', 'Asia/Shanghai')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- 迁移记录（API migrate.js 也会确保存在）
CREATE TABLE IF NOT EXISTS schema_migrations (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  filename     VARCHAR(255) NOT NULL UNIQUE,
  applied_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 预算时段（日历日闭区间，金额为分）
CREATE TABLE IF NOT EXISTS budget_periods (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NULL COMMENT '所属用户',
  title               VARCHAR(200)    NOT NULL COMMENT '预算时段标题',
  description         TEXT            NULL COMMENT '备注',
  start_date          DATE            NOT NULL COMMENT '开始日（北京日历日，含）',
  end_date            DATE            NOT NULL COMMENT '结束日（北京日历日，含）',
  planned_amount_fen  INT UNSIGNED    NOT NULL COMMENT '计划总支出（分）',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_budget_periods_range (start_date, end_date),
  INDEX idx_budget_periods_title (title),
  INDEX idx_budget_periods_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 支出条目（按北京日历日，不强制关联预算）
CREATE TABLE IF NOT EXISTS expense_entries (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NULL COMMENT '所属用户',
  occurred_date   DATE            NOT NULL COMMENT '消费归属日（北京日历日）',
  title           VARCHAR(200)    NOT NULL COMMENT '条目名称',
  amount_fen      INT UNSIGNED    NOT NULL COMMENT '金额（分）',
  note            VARCHAR(500)    NULL COMMENT '备注',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_expenses_date (occurred_date),
  INDEX idx_expenses_date_id (occurred_date, id),
  INDEX idx_expenses_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 每月固定支出模板（硬消费）：花呗、订阅、梯子这类每月都要花的钱
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NULL COMMENT '所属用户',
  title               VARCHAR(200)    NOT NULL COMMENT '条目名称，如 花呗 / AI 订阅 / 梯子',
  category            VARCHAR(50)     NOT NULL DEFAULT '其他' COMMENT '分类标签',
  expected_amount_fen INT UNSIGNED    NOT NULL COMMENT '每月预计金额（分）',
  due_day             TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '每月扣款日 1-31，超出当月天数按当月最后一天算',
  auto_pay            TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否自动扣款',
  enabled             TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '停用后不计入合计',
  note                VARCHAR(500)    NULL COMMENT '备注',
  sort_order          INT             NOT NULL DEFAULT 0 COMMENT '排序',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fixed_expenses_user (user_id),
  INDEX idx_fixed_expenses_sort (user_id, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每月固定支出模板（硬消费）';

-- 固定支出每月实际发生额与付款状态（金额可与预计不同，如花呗账单）
CREATE TABLE IF NOT EXISTS fixed_expense_records (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NULL COMMENT '所属用户',
  fixed_expense_id  BIGINT UNSIGNED NOT NULL,
  billing_month     CHAR(7)         NOT NULL COMMENT '北京日历月 YYYY-MM',
  amount_fen        INT UNSIGNED    NOT NULL COMMENT '该月实际金额（分），覆盖模板预计值',
  paid              TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '该月是否已付',
  paid_date         DATE            NULL COMMENT '付款归属日（北京日历日）',
  note              VARCHAR(500)    NULL COMMENT '备注',
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_fixed_records_item_month (fixed_expense_id, billing_month),
  INDEX idx_fixed_records_user_month (user_id, billing_month),
  CONSTRAINT fk_fixed_records_item
    FOREIGN KEY (fixed_expense_id) REFERENCES fixed_expenses(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='固定支出每月实际发生额与付款状态';
