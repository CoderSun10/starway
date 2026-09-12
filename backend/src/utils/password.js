const bcrypt = require('bcryptjs');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function comparePassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

function hashCode(code) {
  return bcrypt.hash(String(code), 10);
}

function compareCode(code, hashed) {
  return bcrypt.compare(String(code), hashed);
}

module.exports = {
  hashPassword,
  comparePassword,
  hashCode,
  compareCode,
};
