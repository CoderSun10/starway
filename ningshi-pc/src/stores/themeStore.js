import { create } from 'zustand';
import { themes } from '../constants/themes';

const KEY = 'ningshi_pc_theme';

function loadId() {
  try {
    const id = localStorage.getItem(KEY);
    if (id && themes[id]) return id;
  } catch {
    // ignore
  }
  return 'aurora';
}

export const useThemeStore = create((set, get) => ({
  themeId: loadId(),
  theme: themes[loadId()],

  setThemeId(id) {
    const next = themes[id] || themes.aurora;
    try {
      localStorage.setItem(KEY, next.id);
    } catch {
      // ignore
    }
    set({ themeId: next.id, theme: next });
    applyThemeToDom(next);
  },

  applyDom() {
    applyThemeToDom(get().theme);
  },
}));

function primaryRgba(primary, alpha) {
  const hex = String(primary || '').replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  // 已是 rgba / 其它格式时降级
  return `rgba(128,128,128,${alpha})`;
}

/** 同步主题 CSS 变量（滚动条、配色方案） */
function applyThemeToDom(theme) {
  if (typeof document === 'undefined' || !theme) return;
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  // slate 亮色用 light，其余暗色（避免系统滚动条黑白打架）
  root.style.colorScheme = theme.id === 'slate' ? 'light' : 'dark';
  root.style.setProperty('--sb-track', theme.bg || 'transparent');
  root.style.setProperty('--sb-thumb', primaryRgba(theme.primary, 0.38));
  root.style.setProperty('--sb-thumb-hover', primaryRgba(theme.primary, 0.72));
  root.style.setProperty('--app-bg', theme.bg || '#0b0d12');
  root.style.setProperty('--app-text', theme.text || '#e8eef8');
  root.style.setProperty('--app-border', theme.border || 'rgba(128,128,128,0.2)');
  document.body.style.background = theme.bg || '#0b0d12';
}

export function useTheme() {
  return useThemeStore((s) => s.theme);
}
