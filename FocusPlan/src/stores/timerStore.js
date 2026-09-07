import { create } from 'zustand';
import { nowUtcIso } from '../utils/time';

const PRESETS = [45, 60, 75, 90];

/**
 * 计时以「墙钟 endsAtMs」为准，不依赖 setInterval 是否在后台执行。
 * 切到其他 App 再回来时，用 Date.now() 重算剩余时间，不会中断进度。
 */
export const useTimerStore = create((set, get) => ({
  plannedMinutes: 45,
  remainingSeconds: 45 * 60,
  status: 'idle', // idle | running | paused | finished
  startedAtIso: null,
  /** 本段计时结束的绝对时间戳（ms） */
  endsAtMs: null,
  /** 兼容字段：锚点法（与 endsAtMs 同步） */
  tickAnchorMs: null,
  tickRemainingAtAnchor: null,

  presets: PRESETS,

  setPlannedMinutes(minutes) {
    const m = Math.min(200, Math.max(1, Math.round(Number(minutes) || 1)));
    const { status } = get();
    if (status === 'running' || status === 'paused') return;
    set({
      plannedMinutes: m,
      remainingSeconds: m * 60,
      status: 'idle',
      startedAtIso: null,
      endsAtMs: null,
      tickAnchorMs: null,
      tickRemainingAtAnchor: null,
    });
  },

  start() {
    const { status, remainingSeconds, plannedMinutes, startedAtIso } = get();
    if (remainingSeconds <= 0) return;

    const now = Date.now();
    const startIso =
      status === 'paused' && startedAtIso ? startedAtIso : nowUtcIso();
    const endsAtMs = now + remainingSeconds * 1000;

    set({
      status: 'running',
      startedAtIso: startIso,
      endsAtMs,
      tickAnchorMs: now,
      tickRemainingAtAnchor: remainingSeconds,
      plannedMinutes,
    });
  },

  pause() {
    const { status } = get();
    if (status !== 'running') return;
    get().tick();
    set({
      status: 'paused',
      endsAtMs: null,
      tickAnchorMs: null,
      tickRemainingAtAnchor: null,
    });
  },

  /**
   * 按墙钟重算剩余秒数（前台 interval / 从后台回到前台 都调这个）
   */
  tick() {
    const { status, endsAtMs } = get();
    if (status !== 'running' || endsAtMs == null) {
      return get().remainingSeconds;
    }

    const next = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
    if (next <= 0) {
      set({ remainingSeconds: 0, status: 'finished', endsAtMs: null });
      return 0;
    }
    set({ remainingSeconds: next });
    return next;
  },

  /** 从后台恢复时强制同步 */
  syncFromWallClock() {
    return get().tick();
  },

  finishAndReset() {
    const { startedAtIso, plannedMinutes, remainingSeconds, status, endsAtMs } =
      get();
    if (!startedAtIso && status === 'idle') {
      set({
        status: 'idle',
        remainingSeconds: plannedMinutes * 60,
        startedAtIso: null,
        endsAtMs: null,
        tickAnchorMs: null,
        tickRemainingAtAnchor: null,
      });
      return null;
    }

    const endedAtIso = nowUtcIso();
    let durationMinutes = 1;
    if (startedAtIso) {
      const secs = Math.max(
        1,
        Math.round((Date.now() - new Date(startedAtIso).getTime()) / 1000)
      );
      durationMinutes =
        secs < 60
          ? 1
          : Math.min(plannedMinutes, Math.max(1, Math.round(secs / 60)));
    } else {
      durationMinutes = Math.max(
        1,
        plannedMinutes - Math.floor((remainingSeconds || 0) / 60)
      );
    }

    const summary = {
      startedAtIso: startedAtIso || endedAtIso,
      endedAtIso,
      durationMinutes: Math.max(1, durationMinutes),
      plannedMinutes,
      autoFinished:
        status === 'finished' || remainingSeconds <= 0 || (endsAtMs != null && Date.now() >= endsAtMs),
    };

    set({
      status: 'idle',
      remainingSeconds: plannedMinutes * 60,
      startedAtIso: null,
      endsAtMs: null,
      tickAnchorMs: null,
      tickRemainingAtAnchor: null,
    });

    return summary;
  },

  reset() {
    const { plannedMinutes } = get();
    set({
      status: 'idle',
      remainingSeconds: plannedMinutes * 60,
      startedAtIso: null,
      endsAtMs: null,
      tickAnchorMs: null,
      tickRemainingAtAnchor: null,
    });
  },
}));
