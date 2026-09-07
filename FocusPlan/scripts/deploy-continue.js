const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { requireEnv } = require('./load-env');

const HOST = requireEnv('DEPLOY_HOST');
const USER = requireEnv('DEPLOY_USER');
const PASS = requireEnv('DEPLOY_PASS');
const OPT = process.env.DEPLOY_REMOTE_DIR || '/opt/ningshi';
const STAGE = process.env.DEPLOY_STAGE || `/home/${USER}/ningshi-stage`;
const ROOT = path.join(__dirname, '..');

function exec(conn, cmd, ignoreError = false) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${cmd.slice(0, 120)}...`);
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

async function main() {
  const conn = await connect();
  console.log('connected');
  const sf = await sftp(conn);

  const tarLocal = path.join(ROOT, 'ningshi-deploy.tgz');
  if (!fs.existsSync(tarLocal)) {
    const { execSync } = require('child_process');
    execSync(
      `tar.exe -czf "${tarLocal}" --exclude=node_modules --exclude=.git --exclude=.env -C "${ROOT}" backend docker-compose.yml`,
      { stdio: 'inherit' }
    );
  }

  await exec(conn, `mkdir -p ${STAGE}`);
  await new Promise((resolve, reject) => {
    sf.fastPut(tarLocal, `${STAGE}/ningshi-deploy.tgz`, (e) =>
      e ? reject(e) : resolve()
    );
  });
  await new Promise((resolve, reject) => {
    sf.fastPut(
      path.join(__dirname, 'remote-setup.sh'),
      `${STAGE}/remote-setup.sh`,
      (e) => (e ? reject(e) : resolve())
    );
  });

  await exec(conn, `cd ${STAGE} && tar -xzf ningshi-deploy.tgz`);
  await exec(
    conn,
    `echo '${PASS.replace(/'/g, `'\\''`)}' | sudo -S bash -lc "export DEPLOY_USER='${USER}'; export DEPLOY_REMOTE_DIR='${OPT}'; cp -a ${STAGE}/backend ${OPT}/ 2>/dev/null || (mkdir -p ${OPT} && cp -a ${STAGE}/backend ${OPT}/); cp -a ${STAGE}/docker-compose.yml ${OPT}/; chown -R ${USER}:${USER} ${OPT}; chmod +x ${STAGE}/remote-setup.sh; bash ${STAGE}/remote-setup.sh"`
  );

  console.log('\n=== remote public check ===');
  try {
    const res = await fetch(`http://${HOST}:3001/health`);
    const j = await res.json();
    console.log('PUBLIC health:', j);
  } catch (e) {
    console.log('PUBLIC health failed (firewall?):', e.message);
  }

  conn.end();
  console.log('DONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
