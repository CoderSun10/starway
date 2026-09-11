const fs = require('fs');
const os = require('os');
const path = require('path');
const { listMigrationFiles } = require('../../src/migrate');

describe('listMigrationFiles', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starway-mig-'));
    fs.mkdirSync(path.join(dir, 'down'));
    fs.writeFileSync(path.join(dir, '002_ledger_v1.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(dir, '002_x.down.sql'), 'DROP TABLE x;');
    fs.writeFileSync(path.join(dir, 'down', '001_noop.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(dir, '.gitkeep'), '');
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('只列出 up 文件，不含 down 与子目录', () => {
    const files = listMigrationFiles(dir);
    expect(files).toEqual(['002_ledger_v1.sql']);
    expect(files).not.toContain('002_x.down.sql');
    expect(files.some((f) => f.includes('001_noop'))).toBe(false);
  });
});
