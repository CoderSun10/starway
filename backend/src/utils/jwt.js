const jwt = require('jsonwebtoken');

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && String(secret).trim()) return String(secret).trim();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return 'starway_dev_only_secret';
}

function signAccessToken(payload) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, jwtSecret(), { expiresIn });
}

function verifyAccessToken(token) {
  return jwt.verify(token, jwtSecret());
}

module.exports = {
  jwtSecret,
  signAccessToken,
  verifyAccessToken,
};
