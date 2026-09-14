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
