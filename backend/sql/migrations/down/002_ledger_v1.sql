DROP TABLE IF EXISTS expense_entries;
DROP TABLE IF EXISTS budget_periods;
DELETE FROM schema_migrations WHERE filename = '002_ledger_v1.sql';
