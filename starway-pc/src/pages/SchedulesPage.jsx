import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import { fetchSchedules } from '../services/api';
import { formatMinutes, formatRange } from '../utils/time';
import { Button, Card, Empty, Loading, PageHeader, ProgressBar } from '../components/ui';
import { toast } from '../stores/toastStore';

export default function SchedulesPage() {
  const t = useTheme();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchSchedules(q.trim() ? { q: q.trim() } : {});
      setList(data || []);
    } catch (e) {
      toast.error('加载计划失败', e.message);
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
        title="计划"
        sub="管理跨天计划与任务进度"
        right={
          <Button variant="accent" onClick={() => nav('/schedules/new')}>
            新建计划
          </Button>
        }
      />

      <Card style={{ marginBottom: 14 }}>
        <div className="row">
          <input
            className="input"
            placeholder="搜索标题 / 描述"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              borderColor: t.border,
              background: t.inputBg,
              color: t.text,
              flex: 1,
            }}
          />
          <Button variant="ghost" onClick={() => { setLoading(true); load(); }}>
            刷新
          </Button>
        </div>
      </Card>

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Card>
          <Empty title="暂无计划" subtitle="点击右上角新建一个计划" />
        </Card>
      ) : (
        list.map((s) => {
          const pct = s.progress_percent ?? 0;
          return (
            <Link
              key={s.id}
              to={`/schedules/${s.id}`}
              className="list-item"
              style={{
                borderColor: t.border,
                background: t.bgElevated,
                color: t.text,
              }}
            >
              <div className="row-between">
                <strong style={{ fontSize: 16 }}>{s.title}</strong>
                <span
                  style={{
                    color: t.accent,
                    background: t.primarySoft,
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {pct}%
                </span>
              </div>
              <div className="muted" style={{ color: t.textSecondary, marginTop: 6 }}>
                {formatRange(s.start_at, s.end_at)} · 预计 {formatMinutes(s.planned_minutes)}
              </div>
              <div style={{ marginTop: 10 }}>
                <ProgressBar current={pct} total={100} />
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
