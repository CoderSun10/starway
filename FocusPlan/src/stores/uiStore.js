import { create } from 'zustand';

/** 全局 UI：专注黑屏时隐藏底栏等 */
export const useUiStore = create((set) => ({
  hideTabBar: false,
  setHideTabBar: (hide) => set({ hideTabBar: !!hide }),
}));
