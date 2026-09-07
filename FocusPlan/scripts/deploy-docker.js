/**
 * 把 backend + docker-compose 同步到远程并 Docker 启动（不 down -v）。
 *
 * 必填环境变量（写在 FocusPlan/.env）：
 *   DEPLOY_HOST  DEPLOY_USER  DEPLOY_PASS
 * 可选：DEPLOY_REMOTE_DIR  DEPLOY_STAGE  MYSQL_CONTAINER  MYSQL_ROOT_PASSWORD
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { requireEnv } = require('./load-env');

const HOST = requireEnv('DEPLOY_HOST');
const USER = requireEnv('DEPLOY_USER');
const PASS = requireEnv('DEPLOY_PASS');
const OPT = process.env.DEPLOY_REMOTE_DIR || '/opt/ningshi';
const STAGE = process.env.DEPLOY_STAGE || `/home/${USER}/ningshi-stage`;
const MYSQL_CONTAINER = process.env.MYSQL_CONTAINER || 'ningshi_mysql';
const ROOT = path.join(__dirname, '..');

function exec(conn, cmd, ignoreError = false) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${cmd.slice(0, 160)}`);
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('close', (code) => {
        if (code !== 0 && !ignoreError) {
          reject(new Error(`exit ${code}\n${errOut}\n${out}`));
        } else resolve({ code, out, errOut });
      });
      stream.on('data', (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on('data', (d) => {
        const s = d.toString();
        errOut += s;
        process.stderr.write(s);
      });
    });
  });
}

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => resolve(conn))
      .on('error', reject)
      .connect({ host: HOST, username: USER, password: PASS, readyTimeout: 30000 });
  });
}

function sftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((e, s) => (e ? reject(e) : resolve(s)));
  });
}

function writeRemote(sf, remotePath, content) {
  return new Promise((resolve, reject) => {
    const ws = sf.createWriteStream(remotePath);
    ws.on('close', resolve);
    ws.on('error', reject);
    ws.end(content.replace(/\r\n/g, '\n'));
  });
}

async function main() {
  const tarPath = path.join(ROOT, 'ningshi-deploy.tgz');
  console.log('1) 打包 backend + docker-compose（无 node_modules）...');
  if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
  execSync(
    `tar.exe -czf "${tarPath}" --exclude=node_modules --exclude=.git --exclude=tests --exclude=.env -C "${ROOT}" backend docker-compose.yml`,
    { stdio: 'inherit' }
  );

  console.log('2) SSH 连接', HOST);
  const conn = await connect();
  const sf = await sftp(conn);

  console.log('3) 上传到中转目录...');
  await exec(conn, `rm -rf ${STAGE} && mkdir -p ${STAGE}`);
  await new Promise((resolve, reject) => {
    sf.fastPut(tarPath, `${STAGE}/ningshi-deploy.tgz`, (e) =>
      e ? reject(e) : resolve()
    );
  });

  const localEnv = path.join(ROOT, '.env');
  if (fs.existsSync(localEnv)) {
    await new Promise((resolve, reject) => {
      sf.fastPut(localEnv, `${STAGE}/.env`, (e) => (e ? reject(e) : resolve()));
    });
  }

  const applyInner = `#!/bin/bash
set -e
STAGE="${STAGE}"
OPT="${OPT}"
USER_NAME="${USER}"

cd "$STAGE"
tar -xzf ningshi-deploy.tgz

mkdir -p "$OPT"
rm -rf "$OPT/backend"
cp -a "$STAGE/backend" "$OPT/"
cp -a "$STAGE/docker-compose.yml" "$OPT/"
if [ -f "$STAGE/.env" ]; then
  cp -a "$STAGE/.env" "$OPT/.env"
fi
chown -R "$USER_NAME":"$USER_NAME" "$OPT"

systemctl stop ningshi-api 2>/dev/null || true
systemctl disable ningshi-api 2>/dev/null || true

cd "$OPT"
docker compose build --pull=false api
docker compose up -d --remove-orphans mysql
docker compose up -d --remove-orphans --force-recreate api

echo "waiting_health"
ok=0
for i in $(seq 1 50); do
  if curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 3
done

docker ps --filter name=ningshi
if [ "$ok" = "1" ]; then
  echo API_OK
  curl -sS http://127.0.0.1:3001/health || true
  echo
  exit 0
fi

echo API_NOT_READY
docker compose logs --tail=100 api || true
docker compose logs --tail=40 mysql || true
exit 1
`;

  await writeRemote(sf, `${STAGE}/apply-inner.sh`, applyInner);

  const wrapper = `#!/bin/bash
set -e
echo '${PASS.replace(/'/g, `'\\''`)}' | sudo -S bash ${STAGE}/apply-inner.sh
`;
  await writeRemote(sf, `${STAGE}/apply-docker.sh`, wrapper);

  console.log('4) 服务器执行更新（保留 MySQL 数据卷）...');
  await exec(
    conn,
    `chmod +x ${STAGE}/apply-docker.sh ${STAGE}/apply-inner.sh && bash ${STAGE}/apply-docker.sh`
  );

  const mysqlPass = process.env.MYSQL_ROOT_PASSWORD || '';
  if (mysqlPass) {
    console.log('\n5) 核对数据是否仍在（只读 COUNT）...');
    await exec(
      conn,
      `docker exec ${MYSQL_CONTAINER} mysql -uroot -p${mysqlPass} -N -e "SELECT 'schedules', COUNT(*) FROM focusplan.schedules; SELECT 'sessions', COUNT(*) FROM focusplan.pomodoro_sessions;" 2>/dev/null || true`,
      true
    );
  }

  conn.end();

  console.log('\n6) 公网探测...');
  try {
    const r = await fetch(`http://${HOST}:3001/health`);
    const j = await r.json();
    console.log('PUBLIC:', j);
  } catch (e) {
    console.log('PUBLIC fail:', e.message);
  }

  try {
    fs.unlinkSync(tarPath);
  } catch (_) {}

  console.log('\n=== 部署完成 ===');
  console.log(`代码目录: ${OPT}`);
  console.log(`API: http://${HOST}:3001`);
}

main().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
