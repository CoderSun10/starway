import axios from 'axios';
import Constants from 'expo-constants';

/** 默认后端：本机。云端地址请写在 .env 的 EXPO_PUBLIC_API_BASE_URL 或设置页。 */
const DEFAULT_API = 'http://127.0.0.1:3001';

function defaultBaseUrl() {
  // 正式 APK / 开发构建：优先读 app.json extra.apiBaseUrl
  const extra =
    Constants.expoConfig?.extra?.apiBaseUrl ||
    Constants.manifest?.extra?.apiBaseUrl ||
    Constants.manifest2?.extra?.expoClient?.extra?.apiBaseUrl;
  if (extra && String(extra).trim()) {
    return String(extra).replace(/\/$/, '');
  }
  return DEFAULT_API;
}

let baseURL = defaultBaseUrl();

export function getBaseURL() {
  return baseURL;
}

export function setBaseURL(url) {
  baseURL = (url || DEFAULT_API).replace(/\/$/, '');
  api.defaults.baseURL = baseURL;
}

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json',
  },
  responseType: 'json',
  // 强制按 UTF-8 解析
  transformResponse: [
    (data) => {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      }
      return data;
    },
  ],
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      '网络请求失败';
    const err = new Error(message);
    err.status = error.response?.status;
    err.code = error.response?.data?.code;
    err.raw = error;
    return Promise.reject(err);
  }
);

// ---------- Schedules ----------
export async function fetchSchedules(params = {}) {
  const { data } = await api.get('/api/schedules', { params });
  return data.data;
}

export async function fetchSchedule(id) {
  const { data } = await api.get(`/api/schedules/${id}`);
  return data.data;
}

export async function createSchedule(payload) {
  const { data } = await api.post('/api/schedules', payload);
  return data.data;
}

export async function updateSchedule(id, payload) {
  const { data } = await api.put(`/api/schedules/${id}`, payload);
  return data.data;
}

export async function deleteSchedule(id) {
  const { data } = await api.delete(`/api/schedules/${id}`);
  return data;
}

// ---------- Tasks ----------
export async function fetchTasks(params = {}) {
  const { data } = await api.get('/api/tasks', { params });
  return data.data;
}

// ---------- Sessions ----------
export async function fetchSessions(params = {}) {
  const { data } = await api.get('/api/sessions', { params });
  return data.data;
}

export async function createSession(payload) {
  const { data } = await api.post('/api/sessions', payload);
  return data.data;
}

export async function deleteSession(id) {
  const { data } = await api.delete(`/api/sessions/${id}`);
  return data;
}

// ---------- Stats ----------
export async function fetchOverview(params = {}) {
  const { data } = await api.get('/api/stats/overview', { params });
  return data.data;
}

export async function fetchDailyStats(params = {}) {
  const { data } = await api.get('/api/stats/daily', { params });
  return data.data;
}

export async function fetchBySchedule(params = {}) {
  const { data } = await api.get('/api/stats/by-schedule', { params });
  return data.data;
}

export async function fetchByTask(params = {}) {
  const { data } = await api.get('/api/stats/by-task', { params });
  return data.data;
}

export async function fetchScheduleStats(id) {
  const { data } = await api.get(`/api/stats/schedule/${id}`);
  return data.data;
}

// ---------- Settings ----------
export async function fetchSettings() {
  const { data } = await api.get('/api/settings');
  return data.data;
}

export async function updateSettings(payload) {
  const { data } = await api.put('/api/settings', payload);
  return data.data;
}

export async function healthCheck() {
  const { data } = await api.get('/health');
  return data;
}

export default api;
