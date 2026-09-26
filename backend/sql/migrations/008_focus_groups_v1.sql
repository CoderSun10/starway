SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'schedules' AND COLUMN_NAME = 'parent_id'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE schedules ADD COLUMN parent_id BIGINT UNSIGNED NULL COMMENT ''所属大规划，空表示与大规划平级的顶层条目'' AFTER user_id, ADD INDEX idx_schedules_parent (parent_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'schedules' AND COLUMN_NAME = 'is_group'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE schedules ADD COLUMN is_group TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1=大规划，0=小规划；旧数据默认为顶层小规划'' AFTER parent_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'schedules' AND CONSTRAINT_NAME = 'fk_schedules_parent'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE schedules ADD CONSTRAINT fk_schedules_parent FOREIGN KEY (parent_id) REFERENCES schedules (id) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS monthly_focus_plans;
