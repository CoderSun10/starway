import { create } from 'zustand';
import { setBaseURL, getBaseURL } from '../services/api';

/** 时区固定北京时间显示 */
export const TIMEZONE = 'Asia/Shanghai';

/**
 * 客户端偏好（结束反馈等）
 * 非业务主数据，内存即可；重启 App 会回到默认「震动+铃声 / 重」
 */
export const useSettingsStore = create((set, get) => ({
  timezoneMode: TIMEZONE,
  apiBaseUrl: getBaseURL(),
  loading: false,
  loaded: true,

  /** both | vibrate | sound | none */
  feedbackMode: 'both',
  /** light | medium | heavy */
  vibrationLevel: 'heavy',
  /** ringtone preset id */
  ringtoneId: 'beep',

  async load() {
    set({ apiBaseUrl: getBaseURL(), loaded: true, timezoneMode: TIMEZONE });
  },

  setApiBaseUrl(url) {
    setBaseURL(url);
    set({ apiBaseUrl: getBaseURL() });
  },

  setFeedbackMode(mode) {
    set({ feedbackMode: mode });
  },

  setVibrationLevel(level) {
    set({ vibrationLevel: level });
  },

  setRingtoneId(id) {
    set({ ringtoneId: id });
  },

  getFeedbackOptions() {
    const { feedbackMode, vibrationLevel, ringtoneId } = get();
    return {
      mode: feedbackMode,
      vibrationLevel,
      ringtoneId,
    };
  },
}));
