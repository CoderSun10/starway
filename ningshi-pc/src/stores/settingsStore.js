import { create } from 'zustand';

const KEY = 'ningshi_pc_settings';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function persist(partial, get) {
  const next = { ...get(), ...partial };
  const { feedbackMode, ringtoneId, minimizeToTray, openAtLogin } = next;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ feedbackMode, ringtoneId, minimizeToTray, openAtLogin })
    );
  } catch {
    // ignore
  }
}

export const useSettingsStore = create((set, get) => {
  const saved = load();
  return {
    feedbackMode: saved.feedbackMode || 'both',
    ringtoneId: saved.ringtoneId || 'beep',
    minimizeToTray: saved.minimizeToTray !== false,
    openAtLogin: !!saved.openAtLogin,
    desktopReady: false,

    setFeedbackMode(mode) {
      set({ feedbackMode: mode });
      persist({ feedbackMode: mode }, get);
    },
    setRingtoneId(id) {
      set({ ringtoneId: id });
      persist({ ringtoneId: id }, get);
    },
    async setMinimizeToTray(enabled) {
      set({ minimizeToTray: !!enabled });
      persist({ minimizeToTray: !!enabled }, get);
      if (window.ningshiDesktop?.setMinimizeToTray) {
        await window.ningshiDesktop.setMinimizeToTray(!!enabled);
      }
    },
    async setOpenAtLogin(enabled) {
      set({ openAtLogin: !!enabled });
      persist({ openAtLogin: !!enabled }, get);
      if (window.ningshiDesktop?.setOpenAtLogin) {
        await window.ningshiDesktop.setOpenAtLogin(!!enabled);
      }
    },
    async hydrateDesktop() {
      if (!window.ningshiDesktop?.getInfo) {
        set({ desktopReady: true });
        return;
      }
      try {
        // 把本地偏好推给主进程（托盘 / 开机启动）
        await window.ningshiDesktop.setMinimizeToTray(get().minimizeToTray);
        await window.ningshiDesktop.setOpenAtLogin(get().openAtLogin);
        const info = await window.ningshiDesktop.getInfo();
        if (typeof info.openAtLogin === 'boolean') {
          set({ openAtLogin: info.openAtLogin });
          persist({ openAtLogin: info.openAtLogin }, get);
        }
      } catch {
        // ignore
      }
      set({ desktopReady: true });
    },
    getFeedbackOptions() {
      const { feedbackMode, ringtoneId } = get();
      return { mode: feedbackMode, ringtoneId };
    },
  };
});
