import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import useSessionWatchdog from '../hooks/useSessionWatchdog';

export default function RequireAuth() {
  const token = useAuthStore((s) => s.accessToken);
  const loc = useLocation();

  // 挂在受保护路由上：登录后才需要盯着是否离线超时
  useSessionWatchdog();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return <Outlet />;
}
