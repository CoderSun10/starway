import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import { fetchBudgetPeriods } from '../services/api';
import { formatFen } from '../utils/money';
import { Button, Card, Empty, Loading, PageHeader, ProgressBar } from '../components/ui';
import { toast } from '../stores/toastStore';

export default function LedgerPage() {
  const t = useTheme();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchBudgetPeriods(q.trim() ? { q: q.trim() } : {});
      setList(data || []);
    } catch (e) {
      toast.error('加载账本失败', e.message);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="账本"
        sub="按时间段设预算，按日记账"
        right={
          <Button variant="accent" onClick={() => nav('/ledger/new')}>
            新建预算时段
          </Button>
        }
      />
      <Card style={{ marginBottom: 14 }}>
        <div className="row">
          <input
            className="input"
            placeholder="搜索标题"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              borderColor: t.border,
              background: t.inputBg,
              color: t.text,
              flex: 1,
            }}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setLoading(true);
              load();
            }}
          >
            刷新
          </Button>
        </div>
      </Card>
      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Card>
          <Empty title="暂无预算时段" subtitle="先定一个时间段和预计花费" />
        </Card>
      ) : (
        list.map((p) => (
          <Link
            key={p.id}
            to={`/ledger/${p.id}`}
            className="list-item"
            style={{
              borderColor: t.border,
              background: t.bgElevated,
              color: t.text,
            }}
          >
            <div className="row-between">
              <strong style={{ fontSize: 16 }}>{p.title}</strong>
              <span style={{ color: p.overspent ? t.danger : t.accent, fontWeight: 700 }}>
                {p.progress_percent}%
              </span>
            </div>
            <div className="muted" style={{ color: t.textSecondary, marginTop: 6 }}>
              {p.start_date} ~ {p.end_date}
              {list.filter(
                (x) =>
                  x.id !== p.id &&
                  x.start_date <= p.end_date &&
                  x.end_date >= p.start_date
              ).length
                ? ' · 与其他预算重叠'
                : ''}
            </div>
            <div style={{ marginTop: 10 }}>
              <ProgressBar
                current={p.spent_fen}
                total={p.planned_amount_fen}
                percent={p.progress_percent}
                fill={t.accent}
                tone={p.overspent ? 'danger' : undefined}
                label={`已花 ${formatFen(p.spent_fen)} / 预算 ${formatFen(p.planned_amount_fen)}${
                  p.overspent
                    ? ` · 已超支 ${formatFen(p.spent_fen - p.planned_amount_fen)}`
                    : ''
                }`}
              />
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
