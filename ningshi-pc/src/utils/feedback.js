/** 桌面端结束提醒：Web Audio 本地合成，不依赖外网 */

export const FEEDBACK_MODES = [
  { id: 'both', label: '提示音 + 系统通知' },
  { id: 'sound', label: '仅提示音' },
  { id: 'notify', label: '仅系统通知' },
  { id: 'none', label: '关闭' },
];

export const RINGTONE_PRESETS = [
  { id: 'beep', label: '清脆双音' },
  { id: 'alarm', label: '闹钟三连' },
  { id: 'digital', label: '电子滴答' },
  { id: 'gentle', label: '柔和上升' },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!getCtx._ctx) getCtx._ctx = new AC();
  return getCtx._ctx;
}

function tone(ctx, { freq, start, dur, type = 'sine', gain = 0.22 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** 播放本地合成铃声 */
export async function playRingtone(ringtoneId = 'beep') {
  const ctx = getCtx();
  if (!ctx) return { ok: false, error: '当前环境不支持音频' };
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // ignore
    }
  }

  const t0 = ctx.currentTime + 0.02;
  try {
    if (ringtoneId === 'alarm') {
      [660, 880, 1100, 660, 880, 1100].forEach((f, i) => {
        tone(ctx, {
          freq: f,
          start: t0 + i * 0.22,
          dur: 0.16,
          type: 'square',
          gain: 0.12,
        });
      });
      await sleep(1600);
    } else if (ringtoneId === 'digital') {
      for (let i = 0; i < 4; i++) {
        tone(ctx, {
          freq: 1400,
          start: t0 + i * 0.14,
          dur: 0.05,
          type: 'square',
          gain: 0.1,
        });
      }
      tone(ctx, { freq: 1800, start: t0 + 0.7, dur: 0.1, type: 'square', gain: 0.12 });
      tone(ctx, { freq: 1200, start: t0 + 0.88, dur: 0.14, type: 'square', gain: 0.12 });
      await sleep(1200);
    } else if (ringtoneId === 'gentle') {
      tone(ctx, { freq: 523.25, start: t0, dur: 0.28, type: 'triangle', gain: 0.18 });
      tone(ctx, { freq: 659.25, start: t0 + 0.3, dur: 0.32, type: 'triangle', gain: 0.16 });
      tone(ctx, { freq: 783.99, start: t0 + 0.62, dur: 0.4, type: 'triangle', gain: 0.14 });
      await sleep(1200);
    } else {
      // beep
      tone(ctx, { freq: 880, start: t0, dur: 0.12, type: 'sine', gain: 0.22 });
      tone(ctx, { freq: 1175, start: t0 + 0.18, dur: 0.16, type: 'sine', gain: 0.2 });
      await sleep(500);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function showSystemNotification(title, body) {
  try {
    if (window.ningshiDesktop?.showNotification) {
      await window.ningshiDesktop.showNotification({ title, body });
      return true;
    }
  } catch {
    // fall through
  }
  try {
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
        return true;
      }
      if (Notification.permission !== 'denied') {
        const p = await Notification.requestPermission();
        if (p === 'granted') {
          new Notification(title, { body });
          return true;
        }
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * 计时结束反馈
 * @param {{ mode: string, ringtoneId: string }} options
 */
export async function playFinishFeedback(options = {}) {
  const { mode = 'both', ringtoneId = 'beep' } = options;
  if (mode === 'none') return { soundOk: true };

  const wantSound = mode === 'both' || mode === 'sound';
  const wantNotify = mode === 'both' || mode === 'notify';

  let soundOk = true;
  if (wantSound) {
    const r = await playRingtone(ringtoneId);
    soundOk = !!r.ok;
  }
  if (wantNotify) {
    await showSystemNotification('专注时间结束', '请回到星程记录本次专注内容。');
  }
  return { soundOk };
}

/** 设置页试听 */
export async function previewFeedback({ mode, ringtoneId }) {
  return playFinishFeedback({ mode, ringtoneId });
}
