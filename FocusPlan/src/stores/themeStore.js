import { create } from 'zustand';
import { themes } from '../constants/themes';

export const useThemeStore = create((set, get) => ({
  themeId: 'aurum', // 默认鎏金
  theme: themes.aurum,

  setThemeId(id) {
    const next = themes[id] || themes.aurum;
    set({ themeId: next.id, theme: next });
  },

  getTheme() {
    return get().theme;
  },
}));

export function useTheme() {
  return useThemeStore((s) => s.theme);
}
