const bcrypt = require('bcryptjs');
const request = require('supertest');
const { pool } = require('../../src/db');
const { signAccessToken } = require('../../src/utils/jwt');
const { createApp } = require('../../src/app');

async function createTestUser(tag = 'u') {
  const email = `itest_${tag}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}@starway.test`;
  const passwordHash = await bcrypt.hash('test-pass-12', 10);
  const [r] = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    [email, passwordHash]
  );
  const id = r.insertId;
  const token = signAccessToken({ sub: id, email });
  return {
    id,
    email,
    token,
    auth: { Authorization: `Bearer ${token}` },
  };
}

function authed(app, user) {
  const h = user.auth;
  return {
    get: (url) => request(app).get(url).set(h),
    post: (url) => request(app).post(url).set(h),
    put: (url) => request(app).put(url).set(h),
    patch: (url) => request(app).patch(url).set(h),
    delete: (url) => request(app).delete(url).set(h),
  };
}

async function deleteTestUser(id) {
  if (!id) return;
  await pool.query('DELETE FROM users WHERE id = ?', [id]).catch(() => {});
}

module.exports = { createApp, createTestUser, authed, deleteTestUser };
