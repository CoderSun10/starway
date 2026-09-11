import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import { APP_NAME, APP_SLOGAN } from '../constants/brand';
import appIcon from '../assets/icon.png';
import ToastHost from './ToastHost';
import WindowChrome from './WindowChrome';
import TimerRuntime, { TimerMiniBar } from './TimerRuntime';
import NavIcon from './NavIcon';

const GROUPS = [
  {
    id: 'time',
    label: '时间',
    icon: 'time',
    match: (path) =>
      path.startsWith('/focus') ||
      path.startsWith('/schedules') ||
      path === '/stats',
    items: [
      { to: '/focus', label: '计时', icon: '◎' },
      { to: '/schedules', label: '计划', icon: '☰' },
      { to: '/stats', end: true, label: '统计', icon: '▣' },
    ],
  },
  {
    id: 'money',
    label: '用度',
    icon: 'money',
    match: (path) => path.startsWith('/money') || path.startsWith('/ledger'),
    items: [
      { to: '/money/journal', label: '记账', icon: '✎' },
      { to: '/ledger', label: '账本', icon: '☰' },
      { to: '/money/stats', label: '统计', icon: '▣' },
    ],
  },
];

export default function Layout() {
  const t = useTheme();
  const loc = useLocation();
  const framed =
    typeof window !== 'undefined' && !!window.ningshiDesktop?.minimize;
  const [open, setOpen] = useState({ time: false, money: false });
  const [maximized, setMaximized] = useState(false);

  const activeGroup = useMemo(() => {
    const path = loc.pathname || '/';
    return GROUPS.find((g) => g.match(path))?.id || null;
  }, [loc.pathname]);

  useEffect(() => {
    if (!activeGroup) return;
    setOpen((prev) => ({ ...prev, [activeGroup]: true }));
  }, [activeGroup]);

  useEffect(() => {
    const d = window.ningshiDesktop;
    if (!d?.isMaximized) return undefined;
    d.isMaximized().then(setMaximized).catch(() => {});
    return d.onMaximizedChange?.(setMaximized);
  }, []);

  const itemStyle = (isActive) => ({
    color: isActive ? t.sidebarActive : t.sidebarText,
    background: isActive ? t.sidebarActiveBg : 'transparent',
  });

  const shellStyle = {
    background: t.bg,
    color: t.text,
    ['--focus-ring']: t.primarySoft,
    ['--sb-track']: t.bg,
    ['--sb-thumb']: t.primarySoft,
    ['--sb-thumb-hover']: t.primary,
  };

  return (
    <div
      className={`app-shell${framed ? ' framed' : ''}${maximized ? ' is-max' : ''}`}
      style={shellStyle}
    >
      <aside
        className="sidebar"
        style={{
          background: t.sidebar,
          borderRightColor: t.border,
          color: t.sidebarText,
        }}
      >
        <div className="sidebar-brand window-drag">
          <div className="sidebar-brand-row">
            <img className="sidebar-logo" src={appIcon} alt="" />
            <strong style={{ color: t.sidebarActive }}>{APP_NAME}</strong>
          </div>
          <span>{APP_SLOGAN}</span>
        </div>
        <nav className="nav-list">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            style={({ isActive }) => itemStyle(isActive)}
          >
            <span className="ico">
              <NavIcon name="cal" />
            </span>
            <span className="label-text">日历</span>
          </NavLink>

          {GROUPS.map((group) => {
            const expanded = !!open[group.id];
            const groupOn = activeGroup === group.id;
            return (
              <div key={group.id} className="nav-group">
                <button
                  type="button"
                  className={`nav-item nav-toggle${groupOn ? ' active' : ''}`}
                  onClick={() =>
                    setOpen((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                  }
                  style={itemStyle(groupOn)}
                >
                  <span className="ico">
                    <NavIcon name={group.icon} />
                  </span>
                  <span className="label-text">{group.label}</span>
                  <span className={`nav-caret${expanded ? ' open' : ''}`}>▸</span>
                </button>
                <div className={`nav-sub-wrap${expanded ? ' open' : ''}`}>
                  <div className="nav-sub-inner">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `nav-item nav-sub${isActive ? ' active' : ''}`
                        }
                        style={({ isActive }) => itemStyle(isActive)}
                      >
                        <span className="ico">{item.icon}</span>
                        <span className="label-text">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            style={({ isActive }) => itemStyle(isActive)}
          >
            <span className="ico">
              <NavIcon name="gear" />
            </span>
            <span className="label-text">设置</span>
          </NavLink>
        </nav>
      </aside>

      <WindowChrome />

      <main className="main" style={{ background: t.bg }}>
        <TimerMiniBar />
        <div className="main-inner scroll-y">
          <Outlet />
        </div>
      </main>
      <TimerRuntime />
      <ToastHost />
    </div>
  );
}
