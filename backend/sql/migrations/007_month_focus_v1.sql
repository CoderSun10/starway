CREATE TABLE IF NOT EXISTS monthly_focus_plans (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NULL COMMENT '所属用户',
  month            CHAR(7)         NOT NULL COMMENT '北京日历月 YYYY-MM',
  planned_minutes  INT UNSIGNED    NOT NULL COMMENT '当月预计总工时（分钟）',
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_monthly_focus_user_month (user_id, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每月专注大规划的预计总工时';
