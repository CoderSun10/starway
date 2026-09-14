import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../stores/themeStore';
import {
  createFixedExpense,
  deleteFixedExpense,
  fetchFixedExpenses,
  updateFixedExpense,
} from '../services/api';
import { fenToYuanString, formatFen, yuanToFen } from '../utils/money';
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
  const [items, setItems] = useState([]);
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
      const data = await fetchFixedExpenses();
      setItems(data.list || []);
    } catch (e) {
      toast.error('加载固定支出失败', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = items
    .filter((x) => x.enabled)
    .reduce((s, x) => s + x.expected_amount_fen, 0);

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
      <PageHeader title="固定支出" sub="每月都要花的钱，和按日记账分开算" />

      <div className="grid-2">
        <Card>
          <h3 style={{ margin: '0 0 10px', color: t.text }}>
            {editingId ? '修改' : '新增'}
          </h3>
          <form onSubmit={onSubmit}>
            <Field label="名称">
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="grok会员订阅"
              />
            </Field>
            <Field label="每月金额（元）">
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
            <h3 style={{ margin: 0, color: t.text }}>清单</h3>
            <strong style={{ color: t.accent }}>{formatFen(total)}</strong>
          </div>
          {loading ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty title="还没有固定支出" subtitle="把每月必花的钱加进来" />
          ) : (
            items.map((row) => (
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
                    每月 {row.due_day} 号
                    {row.enabled ? '' : ' · 已停用'}
                  </div>
                </div>
                <div className="row">
                  <strong>{formatFen(row.expected_amount_fen)}</strong>
                  <IconButton name="edit" title="修改" onClick={() => startEdit(row)} />
                  <IconButton
                    name="trash"
                    title="删除"
                    danger
                    onClick={() => onDelete(row)}
                  />
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
