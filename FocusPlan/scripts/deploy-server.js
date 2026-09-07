/**
 * 部署后端到远程主机：上传 → 远程目录 → Docker MySQL + systemd API
 *
 * 必填：DEPLOY_HOST  DEPLOY_USER  DEPLOY_PASS（FocusPlan/.env）
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { requireEnv } = require('./load-env');

const HOST = requireEnv('DEPLOY_HOST');
const USER = requireEnv('DEPLOY_USER');
const PASS = requireEnv('DEPLOY_PASS');
const REMOTE_OPT = process.env.DEPLOY_REMOTE_DIR || '/opt/ningshi';
const REMOTE_STAGE = process.env.DEPLOY_STAGE || `/home/${USER}/ningshi-stage`;
const MYSQL_CONTAINER = process.env.MYSQL_CONTAINER || 'ningshi_mysql';
const ROOT = path.join(__dirname, '..');

function sshExec(conn, cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    console.log(`$ ${cmd}`);
    conn.exec(cmd, { pty: opts.pty !== false }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('close', (code) => {
        if (code !== 0 && !opts.ignoreError) {
          reject(new Error(`exit ${code}: ${errOut || out}`));
        } else {
          resolve({ code, out, errOut });
        }
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
      .connect({
        host: HOST,
        port: 22,
        username: USER,
        password: PASS,
        readyTimeout: 30000,
        tryKeyboard: true,
      });
  });
}

function getSftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
  });
}

async function main() {
  const tarPath = path.join(ROOT, 'ningshi-deploy.tgz');
  console.log('Packing backend + docker-compose...');
  if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
  execSync(
    `tar.exe -czf "${tarPath}" --exclude=node_modules --exclude=.git --exclude=.env -C "${ROOT}" backend docker-compose.yml`,
    { stdio: 'inherit' }
  );

  console.log('Connecting', HOST, '...');
  const conn = await connect();
  console.log('SSH connected');

  await sshExec(conn, `rm -rf ${REMOTE_STAGE} && mkdir -p ${REMOTE_STAGE}`);

  const sftp = await getSftp(conn);
  await new Promise((resolve, reject) => {
    sftp.fastPut(tarPath, `${REMOTE_STAGE}/ningshi-deploy.tgz`, (err) =>
      err ? reject(err) : resolve()
    );
  });

  const localEnv = path.join(ROOT, '.env');
  const localBackendEnv = path.join(ROOT, 'backend', '.env');
  if (fs.existsSync(localEnv)) {
    await new Promise((resolve, reject) => {
      sftp.fastPut(localEnv, `${REMOTE_STAGE}/.env`, (err) =>
        err ? reject(err) : resolve()
      );
    });
  }
  if (fs.existsSync(localBackendEnv)) {
    await new Promise((resolve, reject) => {
      sftp.fastPut(localBackendEnv, `${REMOTE_STAGE}/backend.env`, (err) =>
        err ? reject(err) : resolve()
      );
    });
  }

  await sshExec(conn, `cd ${REMOTE_STAGE} && tar -xzf ningshi-deploy.tgz && ls -la`);

  const sudo = (cmd) =>
    sshExec(
      conn,
      `echo '${PASS.replace(/'/g, `'\\''`)}' | sudo -S bash -lc ${JSON.stringify(cmd)}`
    );

  await sudo(
    `mkdir -p ${REMOTE_OPT} && rm -rf ${REMOTE_OPT}/backend ${REMOTE_OPT}/docker-compose.yml && cp -a ${REMOTE_STAGE}/backend ${REMOTE_OPT}/ && cp -a ${REMOTE_STAGE}/docker-compose.yml ${REMOTE_OPT}/ && if [ -f ${REMOTE_STAGE}/.env ]; then cp -a ${REMOTE_STAGE}/.env ${REMOTE_OPT}/.env; fi && if [ -f ${REMOTE_STAGE}/backend.env ]; then cp -a ${REMOTE_STAGE}/backend.env ${REMOTE_OPT}/backend/.env; fi && chown -R ${USER}:${USER} ${REMOTE_OPT} && ls -la ${REMOTE_OPT}`
  );

  await sudo(`
set -e
export DEBIAN_FRONTEND=noninteractive
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  usermod -aG docker ${USER} || true
  systemctl enable --now docker
fi
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
docker --version
node --version
`);

  const mysqlPass = process.env.MYSQL_ROOT_PASSWORD || '';
  await sudo(`
cd ${REMOTE_OPT}
docker compose down || true
docker compose up -d
echo "Waiting MySQL..."
for i in $(seq 1 40); do
  if docker exec ${MYSQL_CONTAINER} mysqladmin ping -h 127.0.0.1 -uroot -p${mysqlPass} --silent 2>/dev/null; then
    echo MySQL ready
    break
  fi
  sleep 3
done
docker ps
`);

  await sshExec(conn, `cd ${REMOTE_OPT}/backend && npm install --omit=dev`);

  const serviceUnit = `[Unit]
Description=Ningshi Focus API
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=${USER}
WorkingDirectory=${REMOTE_OPT}/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
`;
  await new Promise((resolve, reject) => {
    const ws = sftp.createWriteStream(`${REMOTE_STAGE}/ningshi-api.service`);
    ws.on('close', resolve);
    ws.on('error', reject);
    ws.end(serviceUnit);
  });

  await sudo(`
cp ${REMOTE_STAGE}/ningshi-api.service /etc/systemd/system/ningshi-api.service
systemctl daemon-reload
systemctl enable ningshi-api
systemctl restart ningshi-api
sleep 2
systemctl status ningshi-api --no-pager || true
if command -v ufw >/dev/null 2>&1; then
  ufw allow 3001/tcp || true
  ufw allow 22/tcp || true
fi
curl -sS http://127.0.0.1:3001/health || true
`);

  conn.end();
  try {
    fs.unlinkSync(tarPath);
  } catch (_) {}
  console.log('\n=== DEPLOY DONE ===');
  console.log(`API: http://${HOST}:3001/health`);
  console.log(`Dir: ${REMOTE_OPT}`);
}

main().catch((e) => {
  console.error('DEPLOY FAILED:', e);
  process.exit(1);
});
