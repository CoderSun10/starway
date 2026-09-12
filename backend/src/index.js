require('dotenv').config();

const { createApp } = require('./app');
const { runMigrations } = require('./migrate');
const { isEmailConfigured, emailConfig } = require('./services/emailService');

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

async function boot() {
  try {
    await runMigrations();
  } catch (err) {
    console.error('[migrate] aborted:', err.message);
    process.exit(1);
  }
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`星程 API running at http://${HOST}:${PORT}`);
    console.log(`Health: http://127.0.0.1:${PORT}/health`);
    if (isEmailConfigured()) {
      console.log(`[email] SMTP ${emailConfig().host} as ${emailConfig().user}`);
    } else {
      console.warn(
        '[email] SMTP 未配置：请在 .env 填写 EMAIL_USER / EMAIL_PASS（QQ 邮箱授权码）'
      );
    }
  });
}

boot();
