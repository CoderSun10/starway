CREATE TABLE IF NOT EXISTS budget_periods (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title               VARCHAR(200)    NOT NULL COMMENT '预算时段标题',
  description         TEXT            NULL COMMENT '备注',
  start_date          DATE            NOT NULL COMMENT '开始日（北京日历日，含）',
  end_date            DATE            NOT NULL COMMENT '结束日（北京日历日，含）',
  planned_amount_fen  INT UNSIGNED    NOT NULL COMMENT '计划总支出（分）',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_budget_periods_range (start_date, end_date),
  INDEX idx_budget_periods_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expense_entries (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  occurred_date   DATE            NOT NULL COMMENT '消费归属日（北京日历日）',
  title           VARCHAR(200)    NOT NULL COMMENT '条目名称',
  amount_fen      INT UNSIGNED    NOT NULL COMMENT '金额（分）',
  note            VARCHAR(500)    NULL COMMENT '备注',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_expenses_date (occurred_date),
  INDEX idx_expenses_date_id (occurred_date, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
