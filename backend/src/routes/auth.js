const crypto = require('crypto');
const express = require('express');
const { query, withTransaction } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { authRequired, userId, httpError } = require('../middleware/auth');
const {
  hashPassword,
  comparePassword,
  hashCode,
  compareCode,
} = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');
const {
  isEmailConfigured,
  sendVerificationCode,
} = require('../services/emailService');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_GAP_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function assertEmail(email) {
  if (!email || email.length > 120 || !EMAIL_RE.test(email)) {
    throw httpError(400, '邮箱格式不正确', 'VALIDATION_ERROR');
  }
  return email;
}

function assertPassword(password) {
  const p = String(password || '');
  if (p.length < 8) throw httpError(400, '密码至少 8 位', 'VALIDATION_ERROR');
  if (p.length > 64) throw httpError(400, '密码不能超过 64 位', 'VALIDATION_ERROR');
  return p;
}

function assertPurpose(purpose) {
  if (purpose !== 'register' && purpose !== 'reset') {
    throw httpError(400, '验证码用途无效', 'VALIDATION_ERROR');
  }
  return purpose;
}

function publicUser(row) {
  return {
    id: Number(row.id),
    email: row.email,
    created_at: row.created_at,
  };
}

function issueSession(user) {
  return {
    user: publicUser(user),
    accessToken: signAccessToken({ sub: Number(user.id), email: user.email }),
  };
}

function echoCodeEnabled() {
  return (
    process.env.NODE_ENV === 'test' &&
    String(process.env.AUTH_DEV_ECHO_CODE || '') === '1'
  );
}

function asUtc(sqlDt) {
  const s = String(sqlDt || '');
  if (!s) return new Date(0);
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  return new Date(`${s.replace(' ', 'T')}Z`);
}

async function consumeCode(email, purpose, code) {
  const rows = await query(
    `SELECT * FROM email_codes
     WHERE email = ? AND purpose = ? AND used_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [email, purpose]
  );
  if (!rows.length) {
    throw httpError(400, '请先获取验证码', 'CODE_INVALID');
  }
  const rec = rows[0];
  if (asUtc(rec.expires_at).getTime() < Date.now()) {
    throw httpError(400, '验证码已过期，请重新获取', 'CODE_EXPIRED');
  }
  if (Number(rec.attempts) >= MAX_ATTEMPTS) {
    throw httpError(429, '验证码尝试次数过多，请重新获取', 'CODE_LOCKED');
  }
  const ok = await compareCode(code, rec.code_hash);
  if (!ok) {
    await query('UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?', [
      rec.id,
    ]);
    throw httpError(400, '验证码错误', 'CODE_INVALID');
  }
  await query('UPDATE email_codes SET used_at = UTC_TIMESTAMP() WHERE id = ?', [
    rec.id,
  ]);
}

router.post(
  '/send-code',
  asyncHandler(async (req, res) => {
    const email = assertEmail(normalizeEmail(req.body?.email));
    const purpose = assertPurpose(String(req.body?.purpose || 'register'));

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (purpose === 'register' && existing.length) {
      throw httpError(409, '该邮箱已被注册', 'USER_ALREADY_EXISTS');
    }

    const recent = await query(
      `SELECT created_at FROM email_codes
       WHERE email = ? AND purpose = ?
       ORDER BY id DESC LIMIT 1`,
      [email, purpose]
    );
    if (recent.length) {
      const last = asUtc(recent[0].created_at).getTime();
      if (Date.now() - last < RESEND_GAP_MS) {
        throw httpError(429, '发送过于频繁，请稍后再试', 'RATE_LIMITED');
      }
    }

    const shouldSend = purpose === 'register' || existing.length > 0;
    const code = String(crypto.randomInt(100000, 1000000));

    if (shouldSend) {
      const codeHash = await hashCode(code);
      const expires = new Date(Date.now() + CODE_TTL_MS)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
      await query(
        `INSERT INTO email_codes (email, purpose, code_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
        [email, purpose, codeHash, expires]
      );

      if (isEmailConfigured()) {
        try {
          await sendVerificationCode(email, code, purpose);
        } catch (err) {
          if (err.status) throw err;
          console.error('[email] send failed:', err.message);
          throw httpError(502, '邮件发送失败，请稍后重试', 'EMAIL_SEND_FAILED');
        }
      } else if (!echoCodeEnabled()) {
        throw httpError(
          503,
          '邮件服务未配置，请在 .env 填写 EMAIL_USER / EMAIL_PASS（QQ 邮箱授权码）',
          'EMAIL_NOT_CONFIGURED'
        );
      } else {
        console.warn(`[auth] EMAIL not configured; echo code for ${email}: ${code}`);
      }
    }

    const payload = {
      success: true,
      message:
        purpose === 'reset'
          ? '如果该邮箱已注册，你将收到验证码邮件'
          : '验证码已发送，请查收邮箱',
    };
    if (echoCodeEnabled() && shouldSend) payload.devCode = code;
    res.json(payload);
  })
);

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const email = assertEmail(normalizeEmail(req.body?.email));
    const password = assertPassword(req.body?.password);
    const code = String(req.body?.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      throw httpError(400, '请输入 6 位邮箱验证码', 'VALIDATION_ERROR');
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      throw httpError(409, '该邮箱已被注册', 'USER_ALREADY_EXISTS');
    }

    await consumeCode(email, 'register', code);
    const passwordHash = await hashPassword(password);

    const user = await withTransaction(async (conn) => {
      const [result] = await conn.execute(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)',
        [email, passwordHash]
      );
      const [rows] = await conn.execute('SELECT * FROM users WHERE id = ?', [
        result.insertId,
      ]);
      return rows[0];
    });

    res.status(201).json({ success: true, message: '注册成功', ...issueSession(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = assertEmail(normalizeEmail(req.body?.email));
    const password = String(req.body?.password || '');
    if (!password) throw httpError(400, '请输入密码', 'VALIDATION_ERROR');

    const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      throw httpError(401, '邮箱或密码错误', 'CREDENTIALS_INVALID');
    }
    const user = rows[0];
    const matched = await comparePassword(password, user.password_hash);
    if (!matched) {
      throw httpError(401, '邮箱或密码错误', 'CREDENTIALS_INVALID');
    }
    res.json({ success: true, message: '登录成功', ...issueSession(user) });
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const email = assertEmail(normalizeEmail(req.body?.email));
    const password = assertPassword(req.body?.password);
    const code = String(req.body?.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      throw httpError(400, '请输入 6 位邮箱验证码', 'VALIDATION_ERROR');
    }

    const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      throw httpError(400, '验证码错误或已过期', 'CODE_INVALID');
    }
    await consumeCode(email, 'reset', code);
    const passwordHash = await hashPassword(password);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      rows[0].id,
    ]);
    res.json({ success: true, message: '密码已重置，请使用新密码登录' });
  })
);

router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const rows = await query(
      'SELECT id, email, created_at FROM users WHERE id = ?',
      [userId(req)]
    );
    if (!rows.length) throw httpError(404, '用户不存在', 'USER_NOT_FOUND');
    res.json({ success: true, data: publicUser(rows[0]) });
  })
);

router.post(
  '/change-password',
  authRequired,
  asyncHandler(async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = assertPassword(req.body?.newPassword);
    const rows = await query('SELECT * FROM users WHERE id = ?', [userId(req)]);
    if (!rows.length) throw httpError(404, '用户不存在', 'USER_NOT_FOUND');
    const matched = await comparePassword(currentPassword, rows[0].password_hash);
    if (!matched) {
      throw httpError(401, '当前密码错误', 'CREDENTIALS_INVALID');
    }
    const passwordHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      rows[0].id,
    ]);
    res.json({ success: true, message: '密码修改成功' });
  })
);

module.exports = router;
