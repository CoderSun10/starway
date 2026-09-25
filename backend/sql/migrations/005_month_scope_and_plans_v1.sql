ALTER TABLE fixed_expenses
  ADD COLUMN billing_month CHAR(7) NULL COMMENT '所属账单月（北京日历月 YYYY-MM）' AFTER user_id;

UPDATE fixed_expenses f
SET f.billing_month = COALESCE(
  (SELECT MAX(r.billing_month) FROM fixed_expense_records r WHERE r.fixed_expense_id = f.id),
  DATE_FORMAT(UTC_DATE(), '%Y-%m')
)
WHERE f.billing_month IS NULL;

ALTER TABLE fixed_expenses
  MODIFY COLUMN billing_month CHAR(7) NOT NULL COMMENT '所属账单月（北京日历月 YYYY-MM）';

CREATE INDEX idx_fixed_expenses_month ON fixed_expenses (user_id, billing_month);

CREATE TABLE IF NOT EXISTS budget_plan_items (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL COMMENT '所属用户',
  period_id   BIGINT UNSIGNED NOT NULL COMMENT '所属账本/预算时段',
  title       VARCHAR(200)    NOT NULL COMMENT '计划条目名称',
  start_date  DATE            NOT NULL COMMENT '计划开始日（北京日历日）',
  end_date    DATE            NOT NULL COMMENT '计划结束日（跨月时大于 start 所在月）',
  amount_fen  INT UNSIGNED    NOT NULL COMMENT '计划金额（分）',
  note        VARCHAR(500)    NULL COMMENT '备注',
  sort_order  INT             NOT NULL DEFAULT 0 COMMENT '排序',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_budget_plan_items_period (period_id),
  INDEX idx_budget_plan_items_user (user_id),
  INDEX idx_budget_plan_items_range (start_date, end_date),
  CONSTRAINT fk_budget_plan_items_period
    FOREIGN KEY (period_id) REFERENCES budget_periods(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账本内的详细计划条目（可跨月）';
