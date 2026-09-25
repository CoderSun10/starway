import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../stores/themeStore';
import {
  createFixedExpense,
  deleteFixedExpense,
  fetchFixedExpenseMonth,
  updateFixedExpense,
} from '../services/api';
import { fenToYuanString, formatFen, yuanToFen } from '../utils/money';
import { todayStr } from '../utils/time';
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

export default function FixedExpensesPage() {
  const t = useTheme();
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [yuan, setYuan] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [saving, setSaving] = useState(false);

  // 界面上不再提供这几项，但保留原值，编辑时原样回传，避免改动已有数据
  const [keep, setKeep] = useState({
    category: '其他',
    auto_pay: false,
    enabled: true,
    note: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFixedExpenseMonth(month);
      setItems(data.items || []);
      setSummary(data.summary || null);
    } catch (e) {
      toast.error('加载固定支出失败', e.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setYuan('');
    setDueDay('1');
    setKeep({ category: '其他', auto_pay: false, enabled: true, note: null });
  }

  function startEdit(row) {
    setEditingId(row.id);
    setTitle(row.title);
    setYuan(fenToYuanString(row.expected_amount_fen).replace(/,/g, ''));
    setDueDay(String(row.due_day));
    setKeep({
      category: row.category,
      auto_pay: row.auto_pay,
      enabled: row.enabled,
      note: row.note,
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const fen = yuanToFen(yuan);
    const day = Number(dueDay);
    if (!title.trim()) {
      toast.error('请填写名称');
      return;
    }
    if (fen == null) {
      toast.error('请填写合法金额');
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      toast.error('扣款日须为 1–31');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        billing_month: month,
        title: title.trim(),
        expected_amount_fen: fen,
        due_day: day,
        ...keep,
      };
      if (editingId) {
        await updateFixedExpense(editingId, payload);
        toast.success('已保存');
      } else {
        await createFixedExpense(payload);
        toast.success('已添加');
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
      await deleteFixedExpense(row.id);
      if (editingId === row.id) resetForm();
      toast.success('已删除');
      load();
    } catch (err) {
      toast.error('删除失败', err.message);
    }
  }

  return (
    <div>
      <PageHeader
        title="固定支出"
        sub="当月要花的固定钱，按每个月单独填写"
        right={
          <TextInput
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value || todayStr().slice(0, 7));
              resetForm();
            }}
            style={{ maxWidth: 160 }}
          />
        }
      />

      <div className="grid-2 pane-grid">
        <Card>
          <h3 style={{ margin: '0 0 10px', color: t.text }}>
            {editingId ? '修改' : `新增（${month} 月）`}
          </h3>
          <form onSubmit={onSubmit}>
            <Field label="名称">
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="grok会员订阅"
              />
            </Field>
            <Field label="当月金额（元）">
              <NumericInput
                integer={false}
                min={0.01}
                max={10000000}
                value={yuan}
                onChange={setYuan}
                onCommit={(n) => setYuan(String(n))}
              />
            </Field>
            <Field label="扣款日（1–31）">
              <NumericInput min={1} max={31} value={dueDay} onChange={setDueDay} />
            </Field>
            <div className="row">
              <Button type="submit" variant="accent" disabled={saving}>
                {saving ? '保存中…' : editingId ? '保存' : '添加'}
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
            <h3 style={{ margin: 0, color: t.text }}>{month} 清单</h3>
            <strong style={{ color: t.accent }}>
              {formatFen(summary?.total_fen ?? 0)}
            </strong>
          </div>
          {summary ? (
            <div
              className="muted"
              style={{ color: t.textSecondary, fontSize: 12, marginBottom: 10 }}
            >
              共 {summary.item_count} 项 · 写进来就算本月已花
            </div>
          ) : null}
          {loading ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty title="这个月还没有固定支出" subtitle="当月要花的钱单独填一份" />
          ) : (
            <div className="pane-scroll">
              {items.map((row) => (
                <div
                  key={row.id}
                  className="row-between"
                  style={{
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottom: `1px solid ${t.border}`,
                    color: t.text,
                    opacity: row.enabled ? 1 : 0.5,
                  }}
                >
                  <div>
                    <div>{row.title}</div>
                    <div className="muted" style={{ color: t.muted, fontSize: 12 }}>
                      {row.due_date} 扣款
                      {row.overridden ? ' · 金额与预计不同' : ''}
                      {row.enabled ? '' : ' · 已停用'}
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
