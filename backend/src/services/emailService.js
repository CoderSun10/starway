/**
 * 邮件发送（从 EduFlow 搬过来的 nodemailer + QQ SMTP 方案）
 * 注册 / 重置密码都发 6 位验证码，适配桌面端（无需点链接）。
 */
const nodemailer = require('nodemailer');

function emailConfig() {
  return {
    host: process.env.EMAIL_HOST || 'smtp.qq.com',
    port: Number(process.env.EMAIL_PORT || 465),
    secure: String(process.env.EMAIL_SECURE || 'true') !== 'false',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    fromName: process.env.EMAIL_FROM_NAME || '星程 Starway',
  };
}

function isEmailConfigured() {
  const c = emailConfig();
  return Boolean(c.host && c.user && c.pass);
}

function createTransporter() {
  const c = emailConfig();
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
}

function codeMailHtml({ title, lead, code, minutes }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #eef1f6; margin: 0; padding: 24px; }
    .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 36px 32px; box-shadow: 0 8px 28px rgba(18,24,38,0.08); }
    .logo { font-size: 22px; font-weight: 700; color: #3d6cf0; margin-bottom: 20px; letter-spacing: 0.04em; }
    h1 { font-size: 18px; color: #121826; margin: 0 0 12px; }
    p { color: #5b667a; line-height: 1.7; margin: 0 0 14px; }
    .code { letter-spacing: 0.28em; font-size: 32px; font-weight: 700; color: #3d6cf0; background: #f3f6ff; border-radius: 12px; padding: 16px 8px; text-align: center; margin: 20px 0; font-family: ui-monospace, Consolas, monospace; }
    .note { font-size: 13px; color: #8b95a8; margin-top: 20px; padding-top: 16px; border-top: 1px solid #eef1f6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">星程 Starway</div>
    <h1>${title}</h1>
    <p>${lead}</p>
    <div class="code">${code}</div>
    <div class="note">
      <p>验证码 ${minutes} 分钟内有效，请勿泄露给他人。</p>
      <p>如果这不是你本人的操作，请忽略本邮件。</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendVerificationCode(to, code, purpose) {
  const isReset = purpose === 'reset';
  const minutes = 10;
  const title = isReset ? '重置你的星程密码' : '验证你的注册邮箱';
  const lead = isReset
    ? '我们收到了密码重置请求。请在应用中输入下面的验证码：'
    : '欢迎注册星程。请在应用中输入下面的验证码完成注册：';
  const c = emailConfig();

  if (!isEmailConfigured()) {
    const err = new Error('邮件服务未配置，请在 .env 填写 EMAIL_USER / EMAIL_PASS');
    err.status = 503;
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const transporter = createTransporter();
  try {
    await transporter.verify();
  } catch (err) {
    console.error('[email] SMTP verify failed:', err.message);
    const e = new Error(
      '邮箱发信账号验证失败，请检查 EMAIL_USER / EMAIL_PASS（须为 QQ 邮箱授权码）'
    );
    e.status = 502;
    e.code = 'EMAIL_AUTH_FAILED';
    throw e;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${c.fromName}" <${c.user}>`,
      to,
      subject: isReset ? '【星程】重置密码验证码' : '【星程】注册邮箱验证码',
      html: codeMailHtml({ title, lead, code, minutes: 10 }),
      text: `${lead}\n\n验证码：${code}\n\n${minutes} 分钟内有效。`,
    });
    console.log('[email] sent', { to, purpose, messageId: info.messageId });
    return { messageId: info.messageId };
  } catch (err) {
    console.error('[email] sendMail failed:', err.message);
    const e = new Error('邮件发送失败，请稍后重试');
    e.status = 502;
    e.code = 'EMAIL_SEND_FAILED';
    throw e;
  }
}

module.exports = {
  emailConfig,
  isEmailConfigured,
  sendVerificationCode,
};
