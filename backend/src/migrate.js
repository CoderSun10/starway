/**
 * API 启动迁移。
 * 只执行 migrations/ 目录下直接子文件，且文件名匹配 /^\d{3}_[\w-]+\.sql$/。
 * 永不执行 *.down.sql，不递归 migrations/down/。
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const UP_RE = /^\d{3}_[\w-]+\.sql$/;
const RETRYABLE = new Set([
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST',
  'ETIMEDOUT',
  'ECONNRESET',
  'ENOTFOUND',
]);

function listMigrationFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => UP_RE.test(name) && !name.endsWith('.down.sql'))
    .sort();
}

function splitSql(sql) {
  return String(sql)
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'));
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      filename     VARCHAR(255) NOT NULL UNIQUE,
      applied_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function runMigrationsOnce(migrationsDir) {
  const dir = migrationsDir || path.join(__dirname, '../sql/migrations');
  const conn = await pool.getConnection();
  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    await ensureMigrationsTable(conn);
    const [appliedRows] = await conn.query(
      'SELECT filename FROM schema_migrations'
    );
    const applied = new Set(appliedRows.map((r) => r.filename));
    const files = listMigrationFiles(dir);
    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`[migrate] skip ${filename}`);
        continue;
      }
      const full = path.join(dir, filename);
      const sql = fs.readFileSync(full, 'utf8');
      const statements = splitSql(sql);
      try {
        for (const stmt of statements) {
          await conn.query(stmt);
        }
        try {
          await conn.query(
            'INSERT INTO schema_migrations (filename) VALUES (?)',
            [filename]
          );
          console.log(`[migrate] applied ${filename}`);
        } catch (insErr) {
          if (insErr.code === 'ER_DUP_ENTRY' || insErr.errno === 1062) {
            console.log(`[migrate] skip (applied by peer) ${filename}`);
          } else {
            throw insErr;
          }
        }
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
          console.log(`[migrate] skip (applied by peer) ${filename}`);
          continue;
        }
        console.error(`[migrate] failed ${filename}:`, err.message);
        throw err;
      }
    }
  } finally {
    conn.release();
  }
}

function isRetryable(err) {
  if (!err) return false;
  if (RETRYABLE.has(err.code)) return true;
  if (err.code === 'ECONNREFUSED') return true;
  const msg = String(err.message || '');
  return /ECONNREFUSED|PROTOCOL_CONNECTION_LOST|ETIMEDOUT|ECONNRESET/.test(msg);
}

async function runMigrations(migrationsDir) {
  let lastErr;
  for (let i = 1; i <= 10; i += 1) {
    try {
      await runMigrationsOnce(migrationsDir);
      return;
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === 10) break;
      console.log(`[migrate] db not ready (${err.code || err.message}), retry ${i}/10`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

module.exports = {
  listMigrationFiles,
  splitSql,
  runMigrations,
  UP_RE,
};
