import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// API 地址由 Vite 按运行模式从 .env.development / .env.production 读取，
// 源码里不写死 IP。改地址请改对应的 .env.* 文件。
const DEFAULT_API = (
  import.meta.env.VITE_API_BASE_URL || ''
).replace(/\/$/, '');

export function getBaseURL() {
  return DEFAULT_API;
}

const api = axios.create({
  baseURL: DEFAULT_API,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message || error.message || '网络请求失败';
    if (status === 401) {
      const path = String(window.location.hash || '');
      const onAuthPage =
        path.includes('/login') ||
        path.includes('/register') ||
        path.includes('/forgot');
      useAuthStore.getState().clear();
      if (!onAuthPage) {
        window.location.hash = '#/login';
      }
    }
    const err = new Error(message);
    err.status = status;
    err.code = error.response?.data?.code;
    return Promise.reject(err);
  }
);

export async function sendAuthCode(payload) {
  const { data } = await api.post('/api/auth/send-code', payload);
  return data;
}

export async function register(payload) {
  const { data } = await api.post('/api/auth/register', payload);
  return data;
}

export async function login(payload) {
  const { data } = await api.post('/api/auth/login', payload);
  return data;
}

export async function fetchMe() {
  const { data } = await api.get('/api/auth/me');
  return data.data;
}

export async function changePassword(payload) {
  const { data } = await api.post('/api/auth/change-password', payload);
  return data;
}

export async function resetPassword(payload) {
  const { data } = await api.post('/api/auth/reset-password', payload);
  return data;
}

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

export async function fetchSessionsPaged(params = {}) {
  const { data } = await api.get('/api/sessions', { params });
  return { list: data.data || [], total: Number(data.total) || 0 };
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

export async function fetchDaySummary(params = {}) {
  const { data } = await api.get('/api/stats/day-summary', { params });
  return data.data;
}

export async function fetchBudgetPeriods(params = {}) {
  const { data } = await api.get('/api/budget-periods', { params });
  return data.data;
}

export async function fetchBudgetPeriod(id) {
  const { data } = await api.get(`/api/budget-periods/${id}`);
  return data.data;
}

export async function createBudgetPeriod(payload) {
  const { data } = await api.post('/api/budget-periods', payload);
  return data.data;
}

export async function updateBudgetPeriod(id, payload) {
  const { data } = await api.put(`/api/budget-periods/${id}`, payload);
  return data.data;
}

export async function deleteBudgetPeriod(id) {
  const { data } = await api.delete(`/api/budget-periods/${id}`);
  return data;
}

export async function fetchExpenses(params = {}) {
  const { data } = await api.get('/api/expenses', { params });
  return data.data;
}

export async function createExpense(payload) {
  const { data } = await api.post('/api/expenses', payload);
  return data.data;
}

export async function updateExpense(id, payload) {
  const { data } = await api.put(`/api/expenses/${id}`, payload);
  return data.data;
}

export async function deleteExpense(id) {
  const { data } = await api.delete(`/api/expenses/${id}`);
  return data;
}

export async function fetchFixedExpenses(params = {}) {
  const { data } = await api.get('/api/fixed-expenses', { params });
  return data.data;
}

export async function fetchFixedExpenseMonth(month) {
  const { data } = await api.get('/api/fixed-expenses/month', {
    params: month ? { month } : {},
  });
  return data.data;
}

export async function createFixedExpense(payload) {
  const { data } = await api.post('/api/fixed-expenses', payload);
  return data.data;
}

export async function updateFixedExpense(id, payload) {
  const { data } = await api.put(`/api/fixed-expenses/${id}`, payload);
  return data.data;
}

export async function deleteFixedExpense(id) {
  const { data } = await api.delete(`/api/fixed-expenses/${id}`);
  return data;
}

/** 记某个月的实际情况：{ amount_fen?, paid?, note?, reset? } */
export async function updateFixedExpenseMonth(id, month, payload) {
  const { data } = await api.put(
    `/api/fixed-expenses/${id}/month/${month}`,
    payload
  );
  return data.data;
}

export default api;
