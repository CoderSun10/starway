const { Client } = require('ssh2');
const { requireEnv } = require('./load-env');

const HOST = requireEnv('DEPLOY_HOST');
const USER = requireEnv('DEPLOY_USER');
const PASS = requireEnv('DEPLOY_PASS');
const cmd = process.argv.slice(2).join(' ') || 'echo hi';
const conn = new Client();
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
  .connect({
    host: HOST,
    username: USER,
    password: PASS,
  });
