import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

// 这些交互算「人在用」
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'pointermove', 'focus'];

// 多久检查一次是否离线超时
const CHECK_INTERVAL_MS = 30 * 1000;

/**
 * 登录态看门狗：有交互就续期，连续 IDLE_LIMIT_MS 没有交互就清掉登录态。
 * 清掉之后 RequireAuth 会把界面送回登录页。
 */
export default function useSessionWatchdog() {
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!token) return undefined;

    const touch = () => useAuthStore.getState().touch();
    touch();

    ACTIVITY_EVENTS.forEach((name) =>
      window.addEventListener(name, touch, { passive: true })
    );

    const timer = window.setInterval(() => {
      const store = useAuthStore.getState();
      if (!store.accessToken) return;
      if (store.isIdleExpired()) store.clear();
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, touch));
      window.clearInterval(timer);
    };
  }, [token]);
}
