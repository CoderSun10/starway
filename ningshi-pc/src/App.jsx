import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import TimerPage from './pages/TimerPage';
import SchedulesPage from './pages/SchedulesPage';
import ScheduleDetailPage from './pages/ScheduleDetailPage';
import ScheduleFormPage from './pages/ScheduleFormPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import { useThemeStore } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';

function DesktopBridge() {
  const nav = useNavigate();
  useEffect(() => {
    useSettingsStore.getState().hydrateDesktop();
    if (!window.ningshiDesktop?.onNavigate) return undefined;
    return window.ningshiDesktop.onNavigate((route) => {
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
          <Route index element={<TimerPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="schedules/new" element={<ScheduleFormPage />} />
          <Route path="schedules/:id" element={<ScheduleDetailPage />} />
          <Route path="schedules/:id/edit" element={<ScheduleFormPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
