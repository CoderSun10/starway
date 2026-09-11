-- 已有 volume 可选灌入。按标题存在性跳过。
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO budget_periods (title, description, start_date, end_date, planned_amount_fen)
SELECT '【demo】日常开销 2026-09', '演示预算', '2026-09-01', '2026-09-30', 300000
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM budget_periods WHERE title = '【demo】日常开销 2026-09'
);

INSERT INTO expense_entries (occurred_date, title, amount_fen, note)
SELECT '2026-09-08', '【demo】午餐', 3200, '公司附近'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM expense_entries WHERE title = '【demo】午餐' AND occurred_date = '2026-09-08'
);

INSERT INTO expense_entries (occurred_date, title, amount_fen, note)
SELECT '2026-09-09', '【demo】地铁', 600, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM expense_entries WHERE title = '【demo】地铁' AND occurred_date = '2026-09-09'
);

INSERT INTO expense_entries (occurred_date, title, amount_fen, note)
SELECT '2026-09-10', '【demo】咖啡', 1800, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM expense_entries WHERE title = '【demo】咖啡' AND occurred_date = '2026-09-10'
);
