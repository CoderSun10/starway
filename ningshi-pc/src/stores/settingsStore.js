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
  const {
    feedbackMode,
    ringtoneId,
    minimizeToTray,
    openAtLogin,
    heatmapTimeMax,
    heatmapSpendYuan,
  } = next;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        feedbackMode,
        ringtoneId,
        minimizeToTray,
        openAtLogin,
        heatmapTimeMax,
        heatmapSpendYuan,
      })
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
    heatmapTimeMax: Number(saved.heatmapTimeMax) > 0 ? Number(saved.heatmapTimeMax) : 120,
    heatmapSpendYuan: Number(saved.heatmapSpendYuan) > 0 ? Number(saved.heatmapSpendYuan) : 100,
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
    setHeatmapTimeMax(minutes) {
      const n = Math.min(600, Math.max(15, Math.round(Number(minutes) || 120)));
      set({ heatmapTimeMax: n });
      persist({ heatmapTimeMax: n }, get);
    },
    setHeatmapSpendYuan(yuan) {
      const n = Math.min(100000, Math.max(1, Math.round(Number(yuan) || 100)));
      set({ heatmapSpendYuan: n });
      persist({ heatmapSpendYuan: n }, get);
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
