import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import { useTimerStore } from '../stores/timerStore';
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  fetchSessions,
} from '../services/api';
import { formatFen, yuanToFen } from '../utils/money';
import { formatMinutes, todayStr } from '../utils/time';
import { Button, Card, Field, TextInput } from './ui';
import { toast } from '../stores/toastStore';

export default function DayPanel({ day, summary, onExpenseChange }) {
  const t = useTheme();
  const nav = useNavigate();
  const isToday = day === todayStr();
  const [expenses, setExpenses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [title, setTitle] = useState('');
  const [yuan, setYuan] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ex, se] = await Promise.all([
          fetchExpenses({ date: day }),
          fetchSessions({ date: day, limit: 50 }),
        ]);
        if (!cancelled) {
          setExpenses(ex || []);
          setSessions(se || []);
        }
      } catch (e) {
        toast.error('加载当日记录失败', e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  async function onAdd(e) {
    e.preventDefault();
    const fen = yuanToFen(yuan);
    const name = title.trim();
    if (!name || fen == null) {
      toast.error('请填写项目和合法金额');
      return;
    }
    setSaving(true);
    try {
      const row = await createExpense({
        occurred_date: day,
        title: name,
        amount_fen: fen,
        note: note.trim() || null,
      });
      setExpenses((prev) => [row, ...prev]);
      setTitle('');
      setYuan('');
      setNote('');
      onExpenseChange?.({ type: 'create', row });
      toast.success('已记账');
    } catch (err) {
      toast.error('记账失败', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row) {
    try {
      await deleteExpense(row.id);
      setExpenses((prev) => prev.filter((x) => x.id !== row.id));
      onExpenseChange?.({ type: 'delete', row });
    } catch (err) {
      toast.error('删除失败', err.message);
    }
  }

  function startFocus() {
    const st = useTimerStore.getState();
    if (st.status === 'idle' || st.status === 'finished') st.start();
    nav('/focus');
  }

  const focusMin = summary?.focus_minutes || 0;
  const spend = summary?.spend_fen || 0;

  return (
    <Card className="day-panel">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <strong style={{ color: t.text }}>{day}</strong>
        {isToday ? (
          <Button variant="accent" onClick={startFocus}>
            开始专注
          </Button>
        ) : null}
      </div>
      <div className="muted" style={{ color: t.textSecondary, marginBottom: 12 }}>
        专注 {formatMinutes(focusMin)} · {summary?.session_count || 0} 个番茄
        {' · '}
        花费 {formatFen(spend)}
      </div>

      <form onSubmit={onAdd}>
        <Field label="消费项目">
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="午餐 / 地铁"
          />
        </Field>
        <Field label="金额（元）">
          <TextInput
            value={yuan}
            onChange={(e) => setYuan(e.target.value)}
            placeholder="32.00"
          />
        </Field>
        <Field label="备注">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="可选"
          />
        </Field>
        <Button type="submit" variant="accent" disabled={saving}>
          记一笔
        </Button>
      </form>

      <h4 style={{ margin: '18px 0 8px', color: t.text }}>当日花费</h4>
      {expenses.length === 0 ? (
        <p className="muted" style={{ color: t.muted }}>
          这一天还没有记账
        </p>
      ) : (
        expenses.map((row) => (
          <div key={row.id} className="row-between" style={{ marginBottom: 8 }}>
            <div>
              <div>{row.title}</div>
              {row.note ? (
                <div className="muted" style={{ color: t.muted }}>
                  {row.note}
                </div>
              ) : null}
            </div>
            <div className="row">
              <strong>{formatFen(row.amount_fen)}</strong>
              <Button variant="ghost" onClick={() => onDelete(row)}>
                删
              </Button>
            </div>
          </div>
        ))
      )}

      <h4 style={{ margin: '18px 0 8px', color: t.text }}>当日专注</h4>
      {sessions.length === 0 ? (
        <p className="muted" style={{ color: t.muted }}>
          没有完成的番茄
        </p>
      ) : (
        sessions.map((s) => (
          <div
            key={s.id}
            className="muted"
            style={{ marginBottom: 6, color: t.textSecondary }}
          >
            {s.content || s.schedule_title || '自由专注'} ·{' '}
            {formatMinutes(s.duration_minutes)}
          </div>
        ))
      )}
    </Card>
  );
}
