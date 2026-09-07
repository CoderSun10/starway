import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../stores/themeStore';
import { useTimerStore } from '../stores/timerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatCountdown } from '../utils/time';
import { playFinishFeedback } from '../utils/feedback';
import { Button, Card, Chip, PageHeader } from '../components/ui';
import SessionSaveModal from '../components/SessionSaveModal';

const R = 130;
const C = 2 * Math.PI * R;

export default function TimerPage() {
  const t = useTheme();
  const {
    plannedMinutes,
    remainingSeconds,
    status,
    presets,
    setPlannedMinutes,
    start,
    pause,
    tick,
    finishAndReset,
    reset,
  } = useTimerStore();

  const [summary, setSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    if (status !== 'running') return undefined;
    const id = setInterval(() => {
      const left = tick();
      if (left <= 0) handleFinish();
    }, 200);
    return () => clearInterval(id);
  }, [status]);

  const progress = useMemo(() => {
    const total = Math.max(1, plannedMinutes * 60);
    return Math.min(1, Math.max(0, 1 - remainingSeconds / total));
  }, [plannedMinutes, remainingSeconds]);

  const statusLabel =
    status === 'running'
      ? '专注中'
      : status === 'paused'
        ? '已暂停'
        : status === 'finished'
          ? '已结束'
          : '就绪';

  async function handleFinish() {
    if (finishing.current) return;
    finishing.current = true;
    try {
      if (useTimerStore.getState().status === 'running') {
        tick();
      }
      const s = finishAndReset();
      if (s) {
        const fb = useSettingsStore.getState().getFeedbackOptions();
        playFinishFeedback(fb).catch(() => {});
        setSummary(s);
        setModalOpen(true);
      }
    } finally {
      finishing.current = false;
    }
  }

  const busy = status === 'running' || status === 'paused';

  return (
    <div>
      <PageHeader title="专注计时" sub="桌面端墙钟计时，切窗口也不会丢进度" />

      <div className="timer-stage">
        <div className="timer-ring-wrap">
          <div className="timer-ring">
            <svg viewBox="0 0 300 300">
              <circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke={t.progressTrack}
                strokeWidth="12"
              />
              <circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke={t.ring}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${C * progress} ${C}`}
                style={{
                  filter: `drop-shadow(0 0 10px ${t.glow})`,
                  transition: 'stroke-dasharray 0.2s linear',
                }}
              />
            </svg>
            <div className="center">
              <div className="timer-time" style={{ color: t.text }}>
                {formatCountdown(remainingSeconds)}
              </div>
              <div className="timer-status" style={{ color: t.textSecondary }}>
                {statusLabel} · 计划 {plannedMinutes} 分钟
              </div>
            </div>
          </div>

          <div className="timer-actions">
            {status === 'idle' || status === 'finished' ? (
              <Button variant="accent" onClick={start} style={{ minWidth: 140 }}>
                开始
              </Button>
            ) : null}
            {status === 'running' ? (
              <Button variant="outline" onClick={pause} style={{ minWidth: 120 }}>
                暂停
              </Button>
            ) : null}
            {status === 'paused' ? (
              <Button variant="accent" onClick={start} style={{ minWidth: 120 }}>
                继续
              </Button>
            ) : null}
            {busy ? (
              <Button variant="danger" onClick={handleFinish} style={{ minWidth: 120 }}>
                结束并保存
              </Button>
            ) : null}
            {!busy && remainingSeconds !== plannedMinutes * 60 ? (
              <Button variant="ghost" onClick={reset}>
                重置
              </Button>
            ) : null}
          </div>
        </div>

        <Card>
          <h3 style={{ margin: '0 0 12px', color: t.text }}>时长预设</h3>
          <div className="chip-row">
            {presets.map((m) => (
              <Chip
                key={m}
                active={plannedMinutes === m}
                onClick={() => setPlannedMinutes(m)}
              >
                {m} 分
              </Chip>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <label className="label" style={{ color: t.textSecondary }}>
              自定义（1–200 分钟）
            </label>
            <input
              className="input"
              type="number"
              min={1}
              max={200}
              disabled={busy}
              value={plannedMinutes}
              onChange={(e) => setPlannedMinutes(Number(e.target.value))}
              style={{
                borderColor: t.border,
                background: t.inputBg,
                color: t.text,
                maxWidth: 160,
              }}
            />
          </div>
          <p className="muted" style={{ color: t.muted, marginTop: 16, lineHeight: 1.6 }}>
            提示：结束后可关联计划或自由记录。后端默认
            <code style={{ marginLeft: 4 }}>http://127.0.0.1:3001</code>
            ，可在设置中修改。
          </p>
        </Card>
      </div>

      <SessionSaveModal
        open={modalOpen}
        summary={summary}
        onClose={() => {
          setModalOpen(false);
          setSummary(null);
        }}
      />
    </div>
  );
}
