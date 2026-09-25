import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import {
  createBudgetPeriod,
  fetchBudgetPeriod,
  updateBudgetPeriod,
} from '../services/api';
import { fenToYuanString, yuanToFen } from '../utils/money';
import { todayStr } from '../utils/time';
import {
  Button,
  Card,
  Field,
  Loading,
  PageHeader,
  TextArea,
  TextInput,
} from '../components/ui';
import { toast } from '../stores/toastStore';

export default function BudgetPeriodFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const qMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.get('month') || '')
    ? searchParams.get('month')
    : null;
  const isEdit = !!id;
  const t = useTheme();
  const nav = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(() => {
    const mm = qMonth || todayStr().slice(0, 7);
    const [y, m] = mm.split('-').map(Number);
    return qMonth ? `${y}年${m}月分段` : `${y}年${m}月账本`;
  });
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(
    () => `${qMonth || todayStr().slice(0, 7)}-01`
  );
  const [endDate, setEndDate] = useState(() => {
    const mm = qMonth || todayStr().slice(0, 7);
    const [y, m] = mm.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${mm}-${String(last).padStart(2, '0')}`;
  });
  const [yuan, setYuan] = useState('3000');

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const data = await fetchBudgetPeriod(id);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setStartDate(data.start_date);
        setEndDate(data.end_date);
        setYuan(fenToYuanString(data.planned_amount_fen).replace(/,/g, ''));
      } catch (e) {
        toast.error('加载失败', e.message);
        nav('/ledger');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, nav]);

  async function onSubmit(e) {
    e.preventDefault();
    const fen = yuanToFen(yuan);
    if (!title.trim() || fen == null) {
      toast.error('请填写标题和合法金额');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        planned_amount_fen: fen,
      };
      if (isEdit) await updateBudgetPeriod(id, payload);
      else await createBudgetPeriod(payload);
      toast.success(isEdit ? '已保存' : '已创建');
      nav('/ledger');
    } catch (err) {
      toast.error('保存失败', err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title={isEdit ? '编辑预算时段' : '新建预算时段'} sub="日期为北京日历日" />
      <Card>
        <form onSubmit={onSubmit}>
          <Field label="标题">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="开始日">
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="结束日">
            <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label="预计总花费（元）">
            <TextInput
              value={yuan}
              onChange={(e) => setYuan(e.target.value)}
              onBlur={() => {
                const fen = yuanToFen(yuan);
                if (fen != null) setYuan(fenToYuanString(fen).replace(/,/g, ''));
              }}
            />
          </Field>
          <Field label="备注">
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="row">
            <Button type="submit" variant="accent" disabled={saving}>
              保存
            </Button>
            <Button variant="ghost" onClick={() => nav('/ledger')}>
              取消
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
