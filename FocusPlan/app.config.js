/**
 * 在 app.json 基础上合并本机环境变量。
 * EXPO_PUBLIC_API_BASE_URL / EAS_PROJECT_ID / EAS_OWNER 放在 .env，不要写进仓库。
 */
module.exports = ({ config }) => {
  const extra = { ...(config.extra || {}) };
  extra.apiBaseUrl = (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    extra.apiBaseUrl ||
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');

  if (process.env.EAS_PROJECT_ID) {
    extra.eas = { ...(extra.eas || {}), projectId: process.env.EAS_PROJECT_ID };
  } else {
    delete extra.eas;
  }

  const next = { ...config, extra };
  if (process.env.EAS_OWNER) {
    next.owner = process.env.EAS_OWNER;
  } else {
    delete next.owner;
  }
  return next;
};
