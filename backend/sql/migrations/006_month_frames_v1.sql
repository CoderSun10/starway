CREATE TABLE IF NOT EXISTS monthly_budgets (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NULL COMMENT '所属用户',
  month               CHAR(7)         NOT NULL COMMENT '北京日历月 YYYY-MM',
  planned_amount_fen  INT UNSIGNED    NOT NULL COMMENT '当月整体预算（分）',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_monthly_budgets_user_month (user_id, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每月账本框架的整体预算';

DROP TABLE IF EXISTS budget_plan_items;
