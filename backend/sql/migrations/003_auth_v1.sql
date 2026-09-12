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

SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='schedules' AND COLUMN_NAME='user_id');
SET @sql := IF(@exists=0, 'ALTER TABLE schedules ADD COLUMN user_id BIGINT UNSIGNED NULL, ADD INDEX idx_schedules_user (user_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='pomodoro_sessions' AND COLUMN_NAME='user_id');
SET @sql := IF(@exists=0, 'ALTER TABLE pomodoro_sessions ADD COLUMN user_id BIGINT UNSIGNED NULL, ADD INDEX idx_sessions_user (user_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='budget_periods' AND COLUMN_NAME='user_id');
SET @sql := IF(@exists=0, 'ALTER TABLE budget_periods ADD COLUMN user_id BIGINT UNSIGNED NULL, ADD INDEX idx_budget_periods_user (user_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='expense_entries' AND COLUMN_NAME='user_id');
SET @sql := IF(@exists=0, 'ALTER TABLE expense_entries ADD COLUMN user_id BIGINT UNSIGNED NULL, ADD INDEX idx_expenses_user (user_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='app_settings' AND COLUMN_NAME='user_id');
SET @sql := IF(@exists=0, 'ALTER TABLE app_settings ADD COLUMN user_id BIGINT UNSIGNED NULL, ADD INDEX idx_settings_user (user_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='app_settings' AND INDEX_NAME='setting_key' AND NON_UNIQUE=0);
SET @sql := IF(@exists>0, 'ALTER TABLE app_settings DROP INDEX setting_key', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='app_settings' AND INDEX_NAME='uk_settings_user_key');
SET @sql := IF(@exists=0, 'ALTER TABLE app_settings ADD UNIQUE KEY uk_settings_user_key (user_id, setting_key)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
