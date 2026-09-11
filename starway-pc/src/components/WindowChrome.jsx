import { useEffect, useState } from 'react';
import { useTheme } from '../stores/themeStore';

function isDesktop() {
  return typeof window !== 'undefined' && !!window.starwayDesktop?.minimize;
}

export default function WindowChrome() {
  const t = useTheme();
  const [maximized, setMaximized] = useState(false);
  const desktop = isDesktop();

  useEffect(() => {
    if (!desktop) return undefined;
    window.starwayDesktop.isMaximized?.().then(setMaximized).catch(() => {});
    return window.starwayDesktop.onMaximizedChange?.(setMaximized);
  }, [desktop]);

  if (!desktop) return null;

  return (
    <div className="window-chrome" style={{ color: t.text }}>
      <div className="window-drag" />
      <div className="window-controls">
        <button
          type="button"
          className="win-btn"
          aria-label="最小化"
          title="最小化"
          onClick={() => window.starwayDesktop.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect y="4.5" width="10" height="1.2" rx="0.4" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="win-btn"
          aria-label={maximized ? '还原' : '最大化'}
          title={maximized ? '还原' : '最大化'}
          onClick={() => window.starwayDesktop.toggleMaximize()}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M2.2 3.2h5.4v5.4H2.2zM3.4 3.2V2.2h5.4v5.4H7.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.15"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect
                x="1.4"
                y="1.4"
                width="7.2"
                height="7.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.15"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="win-btn win-btn-close"
          aria-label="关闭"
          title="关闭"
          onClick={() => window.starwayDesktop.closeWindow()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M1.4 1.4l7.2 7.2M8.6 1.4L1.4 8.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
