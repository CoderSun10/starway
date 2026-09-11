import { useEffect, useState } from 'react';
import { useTheme } from '../stores/themeStore';
import { Button, Field, TextInput } from './ui';
import { fetchSchedules, createSession } from '../services/api';
import { formatMinutes } from '../utils/time';
import { toast } from '../stores/toastStore';

export default function SessionSaveModal({ open, summary, onClose }) {
  const t = useTheme();
  const [mode, setMode] = useState('schedule'); // schedule | free
  const [schedules, setSchedules] = useState([]);
  const [scheduleId, setScheduleId] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [content, setContent] = useState('');
  const [taskProgress, setTaskProgress] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('schedule');
    setContent('');
    setScheduleId(null);
    setTaskId(null);
    setTaskProgress({});
    setLoading(true);
    fetchSchedules()
      .then((list) => {
        const arr = list || [];
        setSchedules(arr);
        if (arr[0]) {
          setScheduleId(arr[0].id);
          const tasks = arr[0].tasks || [];
          const init = {};
          tasks.forEach((tk) => {
            init[tk.id] = Number(tk.completed_percent || 0);
          });
          setTaskProgress(init);
          setTaskId(null);
        }
      })
      .catch((e) => toast.error('加载计划失败', e.message))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open || !summary) return null;

  const current = schedules.find((s) => s.id === scheduleId);
  const tasks = current?.tasks || [];

  const onPickSchedule = (id) => {
    setScheduleId(id);
    setTaskId(null);
    const s = schedules.find((x) => x.id === id);
    const init = {};
    (s?.tasks || []).forEach((tk) => {
      init[tk.id] = Number(tk.completed_percent || 0);
    });
    setTaskProgress(init);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        started_at: summary.startedAtIso,
        ended_at: summary.endedAtIso,
        duration_minutes: summary.durationMinutes,
        planned_minutes: summary.plannedMinutes,
        status: 'completed',
      };
      if (mode === 'schedule') {
        if (!scheduleId) {
          toast.error('请选择计划');
          setSaving(false);
          return;
        }
        payload.schedule_id = scheduleId;
        if (taskId) payload.task_id = taskId;
        const updates = Object.entries(taskProgress)
          .filter(([, pct]) => Number.isFinite(Number(pct)))
          .map(([tid, pct]) => ({
            task_id: Number(tid),
            percent: Math.max(0, Math.min(100, Math.round(Number(pct)))),
          }));
        if (updates.length) payload.task_progress_updates = updates;
      } else {
        payload.content = content.trim() || '自由专注';
      }
      await createSession(payload);
      toast.success('已保存专注记录');
      onClose(true);
    } catch (e) {
      toast.error('保存失败', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-mask" onClick={() => onClose(false)}>
      <div
        className="modal"
        style={{ background: t.bgElevated, borderColor: t.border, color: t.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>保存本次专注</h2>
        <p className="muted" style={{ color: t.textSecondary, marginTop: 0 }}>
          时长 {formatMinutes(summary.durationMinutes)}
          {summary.autoFinished ? ' · 计时到点' : ' · 手动结束'}
        </p>

        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="chip"
            onClick={() => setMode('schedule')}
            style={{
              borderColor: mode === 'schedule' ? t.primary : t.border,
              background: mode === 'schedule' ? t.primarySoft : 'transparent',
              color: mode === 'schedule' ? t.primary : t.textSecondary,
            }}
          >
            关联计划
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => setMode('free')}
            style={{
              borderColor: mode === 'free' ? t.primary : t.border,
              background: mode === 'free' ? t.primarySoft : 'transparent',
              color: mode === 'free' ? t.primary : t.textSecondary,
            }}
          >
            自由记录
          </button>
        </div>

        {loading ? (
          <p style={{ color: t.textSecondary }}>加载中…</p>
        ) : mode === 'schedule' ? (
          <>
            <Field label="计划">
              <select
                className="select"
                value={scheduleId || ''}
                onChange={(e) => onPickSchedule(Number(e.target.value))}
                style={{
                  borderColor: t.border,
                  background: t.inputBg,
                  color: t.text,
                  width: '100%',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            {tasks.length > 0 ? (
              <>
                <Field label="关联任务（可选）">
                  <select
                    className="select"
                    value={taskId || ''}
                    onChange={(e) =>
                      setTaskId(e.target.value ? Number(e.target.value) : null)
                    }
                    style={{
                      borderColor: t.border,
                      background: t.inputBg,
                      color: t.text,
                      width: '100%',
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}
                  >
                    <option value="">不关联具体任务</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.description}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="各任务完成度（可选调整）">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {tasks.map((task) => (
                      <div key={task.id}>
                        <div className="row-between" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: t.text }}>
                            {task.description}
                          </span>
                          <span style={{ fontSize: 12, color: t.primary, fontWeight: 700 }}>
                            {Number(taskProgress[task.id] ?? 0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={Number(taskProgress[task.id] ?? 0)}
                          onChange={(e) =>
                            setTaskProgress((m) => ({
                              ...m,
                              [task.id]: Number(e.target.value),
                            }))
                          }
                          style={{ width: '100%', accentColor: t.primary }}
                        />
                      </div>
                    ))}
                  </div>
                </Field>
              </>
            ) : null}
          </>
        ) : (
          <Field label="内容">
            <TextInput
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="这次专注做了什么"
            />
          </Field>
        )}

        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => onClose(false)} disabled={saving}>
            跳过
          </Button>
          <Button variant="accent" onClick={onSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}
