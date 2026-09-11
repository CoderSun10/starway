function errorHandler(err, req, res, next) {
  console.error('[API Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL_ERROR',
  });
}

function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `接口不存在: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, notFound, asyncHandler };
