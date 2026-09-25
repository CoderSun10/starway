import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import { deleteBudgetPeriod, fetchBudgetPeriod } from '../services/api';
import { formatFen } from '../utils/money';
import { Button, Card, Empty, Loading, PageHeader, ProgressBar } from '../components/ui';
import { toast } from '../stores/toastStore';

export default function BudgetPeriodDetailPage() {
  const { id } = useParams();
  const t = useTheme();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await fetchBudgetPeriod(id));
    } catch (e) {
      toast.error('加载失败', e.message);
      nav('/ledger');
    } finally {
      setLoading(false);
    }
  }, [id, nav]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function onDelete() {
    if (!window.confirm('删除此时段？已记账的支出仍会留在日历上。')) return;
    try {
      await deleteBudgetPeriod(id);
      toast.success('已删除时段');
      nav('/ledger');
    } catch (e) {
      toast.error('删除失败', e.message);
    }
  }

  if (loading || !data) return <Loading />;

  return (
    <div className="stack">
      <PageHeader
        title={data.title}
        sub={`${data.start_date} ~ ${data.end_date}`}
        right={
          <div className="row">
            <Button variant="ghost" onClick={() => nav(`/ledger/${id}/edit`)}>
              编辑
            </Button>
            <Button variant="danger" onClick={onDelete}>
              删除时段
            </Button>
          </div>
        }
      />
      <Card>
        <ProgressBar
          current={data.spent_fen}
          total={data.planned_amount_fen}
          percent={data.progress_percent}
          fill={t.accent}
          tone={data.overspent ? 'danger' : undefined}
          label={`已花 ${formatFen(data.spent_fen)} / 预算 ${formatFen(data.planned_amount_fen)}${
            data.overspent
              ? ` · 已超支 ${formatFen(data.spent_fen - data.planned_amount_fen)}`
              : ''
          }（含固定支出）`}
        />
        <p className="muted" style={{ color: t.muted, marginTop: 10 }}>
          {data.expense_count} 笔 · 剩余 {formatFen(data.remaining_fen)}
        </p>
        {data.description ? <p style={{ color: t.textSecondary }}>{data.description}</p> : null}
      </Card>
      <Card>
        <h3 className="chart-card-title" style={{ color: t.text }}>
          按日
        </h3>
        {(data.daily || []).filter((d) => d.spend_fen > 0).length === 0 ? (
          <Empty title="这段还没有花费" />
        ) : (
          (data.daily || [])
            .filter((d) => d.spend_fen > 0)
            .map((d) => (
              <Link
                key={d.day}
                to={`/money/journal?day=${d.day}`}
                className="row-between"
                style={{ display: 'flex', padding: '8px 0', color: t.text }}
              >
                <span>{d.day}</span>
                <span>
                  {formatFen(d.spend_fen)} · {d.expense_count} 笔
                </span>
              </Link>
            ))
        )}
      </Card>
    </div>
  );
}
