import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import {
  ensureNotificationPermission,
  canUseScheduledLocalNotification,
} from './notifications';
import * as Notifications from 'expo-notifications';

/** 结束提醒方式 */
export const FEEDBACK_MODES = [
  { id: 'both', label: '震动 + 铃声' },
  { id: 'vibrate', label: '仅震动' },
  { id: 'sound', label: '仅铃声' },
  { id: 'none', label: '关闭' },
];

/** 震动强度 */
export const VIBRATION_LEVELS = [
  { id: 'light', label: '轻' },
  { id: 'medium', label: '中' },
  { id: 'heavy', label: '重' },
];

/**
 * 本地铃声（打包进 App，不依赖外网）
 * 之前用 Google 远程 .ogg，国内经常加载失败 → 只有震动没有声音
 */
export const RINGTONE_PRESETS = [
  {
    id: 'beep',
    label: '清脆提示',
    source: require('../../assets/sounds/beep.wav'),
  },
  {
    id: 'alarm',
    label: '闹钟感',
    source: require('../../assets/sounds/alarm.wav'),
  },
  {
    id: 'digital',
    label: '电子滴答',
    source: require('../../assets/sounds/digital.wav'),
  },
  {
    id: 'gentle',
    label: '柔和提示',
    source: require('../../assets/sounds/gentle.wav'),
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, ms, fallback = null) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

let audioReady = false;
let activeSound = null;

/** 初始化播放模式：外放、静音键仍可播（iOS）、Android 走扬声器 */
async function ensureAudioMode() {
  if (audioReady) return;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  });
  audioReady = true;
}

async function unloadActiveSound() {
  if (!activeSound) return;
  const s = activeSound;
  activeSound = null;
  try {
    await s.stopAsync();
  } catch {
    // ignore
  }
  try {
    await s.unloadAsync();
  } catch {
    // ignore
  }
}

/**
 * 震动强度要有明显差异（尤其 Android）：
 * 轻 = 短促一下；中 = 两段中等；重 = 多段长震
 */
export async function playVibration(level = 'heavy') {
  const patterns = {
    light: [0, 90],
    medium: [0, 220, 140, 280],
    heavy: [0, 520, 90, 520, 90, 720, 80, 480],
  };
  const pattern = patterns[level] || patterns.heavy;

  try {
    if (Platform.OS === 'android') {
      Vibration.cancel();
      Vibration.vibrate(pattern, false);
      const approx =
        level === 'heavy' ? 2600 : level === 'medium' ? 900 : 200;
      await sleep(approx);
      return;
    }

    if (level === 'light') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sleep(80);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    } else if (level === 'medium') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await sleep(160);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await sleep(120);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      for (let i = 0; i < 4; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(200);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      try {
        Vibration.vibrate(600);
      } catch {
        // ignore
      }
    }
  } catch {
    try {
      Vibration.cancel();
      Vibration.vibrate(level === 'heavy' ? 900 : level === 'medium' ? 400 : 120);
      await sleep(level === 'heavy' ? 950 : level === 'medium' ? 450 : 150);
    } catch {
      // 模拟器可能无震动硬件
    }
  }
}

/**
 * 播放本地铃声
 * @returns {{ ok: boolean, error?: string }}
 */
export async function playRingtone(ringtoneId = 'beep') {
  const preset =
    RINGTONE_PRESETS.find((r) => r.id === ringtoneId) || RINGTONE_PRESETS[0];

  try {
    await ensureAudioMode();
    await unloadActiveSound();

    const { sound } = await Audio.Sound.createAsync(
      preset.source,
      {
        shouldPlay: true,
        volume: 1.0,
        isLooping: false,
        progressUpdateIntervalMillis: 200,
      },
      null,
      true
    );
    activeSound = sound;

    // 再显式 play 一次，部分 Android 机型 createAsync shouldPlay 不稳定
    const status = await sound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying) {
      await sound.playAsync();
    }

    sound.setOnPlaybackStatusUpdate((st) => {
      if (!st?.isLoaded) return;
      if (st.didJustFinish) {
        unloadActiveSound().catch(() => {});
      }
    });

    // 等整段播完（最长 4s），本地 wav 都很短
    const durationMs = status.isLoaded
      ? Math.min(4000, Math.ceil((status.durationMillis || 1200) + 120))
      : 1500;
    await sleep(durationMs);
    return { ok: true };
  } catch (e) {
    const msg = e?.message || String(e);
    console.warn('[feedback] playRingtone failed:', msg);
    await unloadActiveSound();
    return { ok: false, error: msg };
  }
}

/** 即时本地通知（前台结束时的补充提醒） */
async function flashLocalNotification() {
  if (!canUseScheduledLocalNotification()) return;
  try {
    await ensureNotificationPermission();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('pomodoro_alert', {
        name: '专注结束提醒',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400, 200, 600],
        lightColor: '#F0C14D',
        sound: 'default',
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '专注时间结束',
        body: '请回到凝时记录本次专注内容。',
        sound: true,
        ...(Platform.OS === 'android'
          ? { channelId: 'pomodoro_alert' }
          : {}),
      },
      trigger: null,
    });
  } catch {
    // ignore
  }
}

/**
 * 计时结束综合反馈（可配置）
 * 震动与铃声并行，互不等待
 */
export async function playFinishFeedback(options = {}) {
  const {
    mode = 'both',
    vibrationLevel = 'heavy',
    ringtoneId = 'beep',
  } = options;

  if (mode === 'none') return;

  const tasks = [];

  if (mode === 'both' || mode === 'vibrate') {
    tasks.push(playVibration(vibrationLevel));
  }
  if (mode === 'both' || mode === 'sound') {
    tasks.push(playRingtone(ringtoneId));
  }

  flashLocalNotification().catch(() => {});

  await withTimeout(Promise.all(tasks.map((p) => p.catch(() => {}))), 8000);
}

/**
 * 试听 / 试震（设置页）
 * 震动 + 铃声同时触发；返回铃声是否成功，便于 Toast 提示
 */
export async function previewFeedback({ mode, vibrationLevel, ringtoneId }) {
  if (mode === 'none') {
    return { soundOk: true, vibrated: false };
  }

  const wantVibrate = mode === 'both' || mode === 'vibrate';
  const wantSound = mode === 'both' || mode === 'sound';

  // 并行：不要先震完再播声音（重震要 2.6s，用户会以为只有震动）
  const jobs = [];
  if (wantVibrate) jobs.push(playVibration(vibrationLevel));
  let soundResult = { ok: true };
  if (wantSound) {
    jobs.push(
      playRingtone(ringtoneId).then((r) => {
        soundResult = r || { ok: false };
      })
    );
  }

  await withTimeout(Promise.all(jobs.map((p) => p.catch(() => {}))), 6000);

  return {
    soundOk: wantSound ? !!soundResult.ok : true,
    soundError: soundResult.error,
    vibrated: wantVibrate,
  };
}
