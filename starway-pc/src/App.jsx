import { useEffect } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import CalendarPage from './pages/CalendarPage';
import TimerPage from './pages/TimerPage';
import SchedulesPage from './pages/SchedulesPage';
import ScheduleDetailPage from './pages/ScheduleDetailPage';
import ScheduleFormPage from './pages/ScheduleFormPage';
import LedgerPage from './pages/LedgerPage';
import ExpensesPage from './pages/ExpensesPage';
import BudgetPeriodFormPage from './pages/BudgetPeriodFormPage';
import BudgetPeriodDetailPage from './pages/BudgetPeriodDetailPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import { useThemeStore } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';

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

export default function App() {
  const applyDom = useThemeStore((s) => s.applyDom);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyDom();
  }, [applyDom, theme.id]);

  return (
    <HashRouter>
      <DesktopBridge />
      <Routes>
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
            <Route path="stats" element={<StatsPage mode="money" />} />
          </Route>
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="ledger/new" element={<BudgetPeriodFormPage />} />
          <Route path="ledger/:id" element={<BudgetPeriodDetailPage />} />
          <Route path="ledger/:id/edit" element={<BudgetPeriodFormPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
