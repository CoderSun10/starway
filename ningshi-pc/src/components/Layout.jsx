import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import { APP_NAME, APP_SLOGAN } from '../constants/brand';
import ToastHost from './ToastHost';

const NAV = [
  { to: '/', end: true, label: '专注', icon: '◎' },
  { to: '/schedules', label: '计划', icon: '☰' },
  { to: '/stats', label: '统计', icon: '▦' },
  { to: '/settings', label: '设置', icon: '⚙' },
];

export default function Layout() {
  const t = useTheme();

  // 滚动条/焦点色跟主题走，避免白底黑条
  const shellStyle = {
    background: t.bg,
    color: t.text,
    ['--focus-ring']: t.primarySoft,
    ['--sb-track']: t.bg,
    ['--sb-thumb']: t.primarySoft,
    ['--sb-thumb-hover']: t.primary,
  };

  return (
    <div className="app-shell" style={shellStyle}>
      <aside
        className="sidebar"
        style={{
          background: t.sidebar,
          borderRightColor: t.border,
          color: t.sidebarText,
        }}
      >
        <div className="sidebar-brand">
          <strong style={{ color: t.sidebarActive }}>{APP_NAME}</strong>
          <span>{APP_SLOGAN}</span>
        </div>
        <nav className="nav-list">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              style={({ isActive }) => ({
                color: isActive ? t.sidebarActive : t.sidebarText,
                background: isActive ? t.sidebarActiveBg : 'transparent',
              })}
            >
              <span className="ico">{item.icon}</span>
              <span className="label-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 10px', fontSize: 11, opacity: 0.45 }}>
          桌面端 · Electron
        </div>
      </aside>

      <main className="main" style={{ background: t.bg }}>
        <div className="main-inner scroll-y">
          <Outlet />
        </div>
      </main>
      <ToastHost />
    </div>
  );
}
