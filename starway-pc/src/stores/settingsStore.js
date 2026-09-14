import { create } from 'zustand';
import { storageGet, storageSet } from '../utils/storage';

const KEY = 'starway_pc_settings';

function load() {
  try {
    const raw = storageGet(KEY, 'ningshi_pc_settings');
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
    statsIncludeFixed,
  } = next;
  try {
    storageSet(
      KEY,
      JSON.stringify({
        feedbackMode,
        ringtoneId,
        minimizeToTray,
        openAtLogin,
        heatmapTimeMax,
        heatmapSpendYuan,
        statsIncludeFixed,
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
    // 用度统计是否把每月固定支出算进去
    statsIncludeFixed: !!saved.statsIncludeFixed,
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
      if (window.starwayDesktop?.setMinimizeToTray) {
        await window.starwayDesktop.setMinimizeToTray(!!enabled);
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
    setStatsIncludeFixed(enabled) {
      set({ statsIncludeFixed: !!enabled });
      persist({ statsIncludeFixed: !!enabled }, get);
    },
    async setOpenAtLogin(enabled) {
      set({ openAtLogin: !!enabled });
      persist({ openAtLogin: !!enabled }, get);
      if (window.starwayDesktop?.setOpenAtLogin) {
        await window.starwayDesktop.setOpenAtLogin(!!enabled);
      }
    },
    async hydrateDesktop() {
      if (!window.starwayDesktop?.getInfo) {
        set({ desktopReady: true });
        return;
      }
      try {
        // 把本地偏好推给主进程（托盘 / 开机启动）
        await window.starwayDesktop.setMinimizeToTray(get().minimizeToTray);
        await window.starwayDesktop.setOpenAtLogin(get().openAtLogin);
        const info = await window.starwayDesktop.getInfo();
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
