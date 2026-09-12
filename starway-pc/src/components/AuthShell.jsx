import { useEffect, useState } from 'react';
import { useTheme } from '../stores/themeStore';
import WindowChrome from './WindowChrome';
import ToastHost from './ToastHost';

export default function AuthShell({ children }) {
  const t = useTheme();
  const framed =
    typeof window !== 'undefined' && !!window.starwayDesktop?.minimize;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const d = window.starwayDesktop;
    if (!d?.isMaximized) return undefined;
    d.isMaximized().then(setMaximized).catch(() => {});
    return d.onMaximizedChange?.(setMaximized);
  }, []);

  return (
    <div
      className={`auth-shell${framed ? ' framed' : ''}${maximized ? ' is-max' : ''}`}
      style={{
        background: t.bg,
        color: t.text,
        ['--focus-ring']: t.primarySoft,
      }}
    >
      <WindowChrome />
      <div className="auth-main scroll-y">{children}</div>
      <ToastHost />
    </div>
  );
}
