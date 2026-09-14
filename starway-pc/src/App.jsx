import { useEffect } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import CalendarPage from './pages/CalendarPage';
import TimerPage from './pages/TimerPage';
import SchedulesPage from './pages/SchedulesPage';
import ScheduleDetailPage from './pages/ScheduleDetailPage';
import ScheduleFormPage from './pages/ScheduleFormPage';
import LedgerPage from './pages/LedgerPage';
import ExpensesPage from './pages/ExpensesPage';
import FixedExpensesPage from './pages/FixedExpensesPage';
import BudgetPeriodFormPage from './pages/BudgetPeriodFormPage';
import BudgetPeriodDetailPage from './pages/BudgetPeriodDetailPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import { useThemeStore } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';
import { useAuthStore } from './stores/authStore';
import { fetchMe } from './services/api';

function DesktopBridge() {
  const nav = useNavigate();
  useEffect(() => {
    useSettingsStore.getState().hydrateDesktop();
    if (!window.starwayDesktop?.onNavigate) return undefined;
    return window.starwayDesktop.onNavigate((route) => {
      if (route) nav(route);
    });
  }, [nav]);
  return null;
}

/**
 * 拿着本地 token 问一次服务端是否仍然有效。
 * 账号已不存在或 token 过期时接口返回 401，axios 拦截器会清掉登录态，
 * 于是界面回到登录页，而不是停在一个取不到数据的主页上。
 */
function SessionCheck() {
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!token) return;
    fetchMe()
      .then((user) => useAuthStore.getState().updateUser(user))
      .catch(() => {
        // 401 已由拦截器处理；网络不通就保持现状，交给离线超时判断
      });
  }, [token]);

  return null;
}

export default function App() {
  const applyDom = useThemeStore((s) => s.applyDom);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyDom();
  }, [applyDom, theme.id]);

  return (
    <HashRouter>
      <DesktopBridge />
      <SessionCheck />
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot" element={<ForgotPasswordPage />} />
        <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<CalendarPage />} />
          <Route path="focus" element={<TimerPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="schedules/new" element={<ScheduleFormPage />} />
          <Route path="schedules/:id" element={<ScheduleDetailPage />} />
          <Route path="schedules/:id/edit" element={<ScheduleFormPage />} />
          <Route path="stats" element={<StatsPage mode="focus" />} />
          <Route path="money" element={<Outlet />}>
            <Route index element={<Navigate to="journal" replace />} />
            <Route path="journal" element={<ExpensesPage />} />
            <Route path="fixed" element={<FixedExpensesPage />} />
            <Route path="stats" element={<StatsPage mode="money" />} />
          </Route>
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="ledger/new" element={<BudgetPeriodFormPage />} />
          <Route path="ledger/:id" element={<BudgetPeriodDetailPage />} />
          <Route path="ledger/:id/edit" element={<BudgetPeriodFormPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
