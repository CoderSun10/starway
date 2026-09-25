import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
} from '../services/api';
import { formatFen, yuanToFen, fenToYuanString } from '../utils/money';
import { formatDateTime, todayStr } from '../utils/time';
import {
  Button,
  Card,
  Empty,
  Field,
  IconButton,
  Loading,
  NumericInput,
  PageHeader,
  TextInput,
} from '../components/ui';
import { toast } from '../stores/toastStore';

export default function ExpensesPage() {
  const t = useTheme();
  const [params, setParams] = useSearchParams();
  const qDay = params.get('day');
  const [day, setDay] = useState(
    qDay && /^\d{4}-\d{2}-\d{2}$/.test(qDay) ? qDay : todayStr()
  );
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [yuan, setYuan] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (qDay && /^\d{4}-\d{2}-\d{2}$/.test(qDay) && qDay !== day) setDay(qDay);
  }, [qDay, day]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList((await fetchExpenses({ date: day })) || []);
    } catch (e) {
      toast.error('加载失败', e.message);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setYuan('');
    setNote('');
  }

  function startEdit(row) {
    setEditingId(row.id);
    setTitle(row.title);
    setYuan(fenToYuanString(row.amount_fen).replace(/,/g, ''));
    setNote(row.note || '');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const fen = yuanToFen(yuan);
    const name = title.trim();
    if (!name || fen == null) {
      toast.error('请填写项目和合法金额');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        occurred_date: day,
        title: name,
        amount_fen: fen,
        note: note.trim() || null,
      };
      if (editingId) {
        await updateExpense(editingId, payload);
        toast.success('已更新');
      } else {
        await createExpense(payload);
        toast.success('已记账');
      }
      resetForm();
      load();
    } catch (err) {
      toast.error('保存失败', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row) {
    try {
      await deleteExpense(row.id);
      if (editingId === row.id) resetForm();
      load();
    } catch (err) {
      toast.error('删除失败', err.message);
    }
  }

  const total = list.reduce((s, x) => s + Number(x.amount_fen || 0), 0);

  return (
    <div>
      <PageHeader
        title="记账"
        sub="按日添加、修改花费记录"
        right={
          <TextInput
            type="date"
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setParams({ day: e.target.value });
              resetForm();
            }}
            style={{ maxWidth: 180 }}
          />
        }
      />
      <div className="grid-2 pane-grid">
        <Card>
          <h3 style={{ margin: '0 0 8px', color: t.text }}>
            {editingId ? '修改一笔' : '记一笔'}
          </h3>
          <form onSubmit={onSubmit}>
            <Field label="项目">
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="午餐 / 地铁"
              />
            </Field>
            <Field label="金额（元）">
              <NumericInput
                integer={false}
                min={0.01}
                max={10000000}
                value={yuan}
                onChange={setYuan}
                onCommit={(n) => setYuan(String(n))}
              />
            </Field>
            <Field label="备注">
              <TextInput
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="可选"
              />
            </Field>
            <div className="row">
              <Button type="submit" variant="accent" disabled={saving}>
                {editingId ? '保存修改' : '添加'}
              </Button>
              {editingId ? (
                <Button variant="ghost" onClick={resetForm}>
                  取消
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
        <Card>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: t.text }}>当日记录</h3>
            <strong style={{ color: t.accent }}>{formatFen(total)}</strong>
          </div>
          {loading ? (
            <Loading />
          ) : list.length === 0 ? (
            <Empty title="这一天还没有记账" />
          ) : (
            <div className="pane-scroll">
              {list.map((row) => (
                <div
                  key={row.id}
                  className="row-between"
                  style={{
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottom: `1px solid ${t.border}`,
                    color: t.text,
                  }}
                >
                  <div>
                    <div>{row.title}</div>
                    <div className="muted" style={{ color: t.muted, fontSize: 12 }}>
                      填写于 {formatDateTime(row.created_at)}
                      {row.note ? ` · ${row.note}` : ''}
                    </div>
                  </div>
                  <div className="row">
                    <strong>{formatFen(row.amount_fen)}</strong>
                    <IconButton name="edit" title="修改" onClick={() => startEdit(row)} />
                    <IconButton
                      name="trash"
                      title="删除"
                      danger
                      onClick={() => onDelete(row)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
