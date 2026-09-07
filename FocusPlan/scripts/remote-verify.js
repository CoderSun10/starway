const { Client } = require('ssh2');
const { requireEnv } = require('./load-env');

const HOST = requireEnv('DEPLOY_HOST');
const USER = requireEnv('DEPLOY_USER');
const PASS = requireEnv('DEPLOY_PASS');
const OPT = process.env.DEPLOY_REMOTE_DIR || '/opt/ningshi';
const conn = new Client();
const cmd = `echo '${PASS.replace(/'/g, `'\\''`)}' | sudo -S bash -c 'systemctl stop ningshi-api 2>/dev/null; systemctl disable ningshi-api 2>/dev/null; cd ${OPT} && docker compose ps && docker compose logs --tail=30 api && curl -sS http://127.0.0.1:3001/health && echo'`;

conn
  .on('ready', () => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) throw err;
      stream.on('data', (d) => process.stdout.write(d.toString()));
      stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
      stream.on('close', (code) => {
        conn.end();
        process.exit(code || 0);
      });
    });
  })
  .connect({ host: HOST, username: USER, password: PASS });
