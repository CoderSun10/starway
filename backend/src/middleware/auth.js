const { verifyAccessToken } = require('../utils/jwt');

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

const BEARER = 'Bearer ';

function authRequired(req, _res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith(BEARER)) {
    return next(httpError(401, '请先登录', 'UNAUTHORIZED'));
  }
  const token = header.slice(BEARER.length).trim();
  if (!token) {
    return next(httpError(401, '请先登录', 'UNAUTHORIZED'));
  }
  try {
    const payload = verifyAccessToken(token);
    const id = Number(payload.sub);
    if (!Number.isFinite(id) || id <= 0) {
      return next(httpError(401, '登录已过期，请重新登录', 'UNAUTHORIZED'));
    }
    req.user = { id, email: payload.email || '' };
    return next();
  } catch {
    return next(httpError(401, '登录已过期，请重新登录', 'UNAUTHORIZED'));
  }
}

function userId(req) {
  return Number(req.user.id);
}

module.exports = { authRequired, userId, httpError };
