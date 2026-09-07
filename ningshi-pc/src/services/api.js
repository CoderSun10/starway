import axios from 'axios';

const STORAGE_KEY = 'ningshi_pc_api_base';
const DEFAULT_API = 'http://127.0.0.1:3001';

function loadBase() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && /^https?:\/\//.test(v)) return v.replace(/\/$/, '');
  } catch {
    // ignore
  }
  return DEFAULT_API;
}

let baseURL = loadBase();

export function getBaseURL() {
  return baseURL;
}

export function setBaseURL(url) {
  baseURL = (url || DEFAULT_API).replace(/\/$/, '');
  try {
    localStorage.setItem(STORAGE_KEY, baseURL);
  } catch {
    // ignore
  }
  api.defaults.baseURL = baseURL;
}

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json',
  },
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message || error.message || '网络请求失败';
    const err = new Error(message);
    err.status = error.response?.status;
    err.code = error.response?.data?.code;
    return Promise.reject(err);
  }
);

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

export async function fetchSessions(params = {}) {
  const { data } = await api.get('/api/sessions', { params });
  return data.data;
}

export async function createSession(payload) {
  const { data } = await api.post('/api/sessions', payload);
  return data.data;
}

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

export async function fetchScheduleStats(id) {
  const { data } = await api.get(`/api/stats/schedule/${id}`);
  return data.data;
}

export async function healthCheck() {
  const { data } = await api.get('/health');
  return data;
}

export async function updateTask(id, payload) {
  const { data } = await api.patch(`/api/tasks/${id}`, payload);
  return data.data;
}

export default api;
