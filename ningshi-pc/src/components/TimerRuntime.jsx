import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimerStore } from '../stores/timerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTheme } from '../stores/themeStore';
import { formatCountdown } from '../utils/time';
import { playFinishFeedback } from '../utils/feedback';
import { APP_NAME_FULL } from '../constants/brand';
import SessionSaveModal from './SessionSaveModal';

export function TimerMiniBar() {
  const t = useTheme();
  const nav = useNavigate();
  const status = useTimerStore((s) => s.status);
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds);
  const plannedMinutes = useTimerStore((s) => s.plannedMinutes);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);

  if (status !== 'running' && status !== 'paused') return null;

  return (
    <div
      className="timer-mini"
      style={{
        background: t.bgElevated,
        borderBottom: `1px solid ${t.border}`,
        color: t.text,
      }}
    >
      <button
        type="button"
        className="timer-mini-main"
        onClick={() => nav('/focus')}
      >
        <span className="timer-mini-dot" style={{ background: t.primary }} />
        <strong>{formatCountdown(remainingSeconds)}</strong>
        <span className="muted" style={{ color: t.textSecondary }}>
          {status === 'paused' ? '已暂停' : '专注中'} · {plannedMinutes} 分
        </span>
      </button>
      {status === 'running' ? (
        <button type="button" className="timer-mini-btn" onClick={pause}>
          暂停
        </button>
      ) : (
        <button type="button" className="timer-mini-btn" onClick={start}>
          继续
        </button>
      )}
    </div>
  );
}

export default function TimerRuntime() {
  const status = useTimerStore((s) => s.status);
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds);
  const finishGeneration = useTimerStore((s) => s.finishGeneration);
  const tick = useTimerStore((s) => s.tick);
  const requestFinish = useTimerStore((s) => s.requestFinish);

  const [summary, setSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const finishing = useRef(false);
  const lastTip = useRef(0);

  useEffect(() => {
    if (status !== 'running') return undefined;
    const id = setInterval(() => {
      const left = tick();
      if (left <= 0) requestFinish();
    }, 200);
    return () => clearInterval(id);
  }, [status, tick, requestFinish]);

  useEffect(() => {
    if (finishGeneration === 0) return;
    if (finishing.current) return;
    finishing.current = true;
    try {
      if (useTimerStore.getState().status === 'running') {
        useTimerStore.getState().tick();
      }
      const s = useTimerStore.getState().finishAndReset();
      if (!s) return;
      playFinishFeedback(useSettingsStore.getState().getFeedbackOptions()).catch(
        () => {}
      );
      setSummary(s);
      setModalOpen(true);
    } finally {
      finishing.current = false;
    }
  }, [finishGeneration]);

  useEffect(() => {
    const desktop = window.ningshiDesktop;
    if (!desktop?.setTrayTooltip) return undefined;
    const now = Date.now();
    if (now - lastTip.current < 1000 && status === 'running') return undefined;
    lastTip.current = now;
    const text =
      status === 'running' || status === 'paused'
        ? `星程 · 专注中 ${formatCountdown(remainingSeconds)}`
        : APP_NAME_FULL;
    desktop.setTrayTooltip(text).catch(() => {});
    return undefined;
  }, [status, remainingSeconds]);

  return (
    <SessionSaveModal
      open={modalOpen}
      summary={summary}
      onClose={() => {
        setModalOpen(false);
        setSummary(null);
      }}
    />
  );
}
