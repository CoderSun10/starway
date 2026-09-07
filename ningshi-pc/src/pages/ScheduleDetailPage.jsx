import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import {
  deleteSchedule,
  fetchSchedule,
  fetchScheduleStats,
} from '../services/api';
import { formatDateTime, formatMinutes, formatRange } from '../utils/time';
import {
  Button,
  Card,
  Empty,
  Loading,
  PageHeader,
  ProgressBar,
} from '../components/ui';
import { toast } from '../stores/toastStore';

export default function ScheduleDetailPage() {
  const { id } = useParams();
  const t = useTheme();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [detail, st] = await Promise.all([
        fetchSchedule(id),
        fetchScheduleStats(id),
      ]);
      setData(detail);
      setStats(st);
    } catch (e) {
      toast.error('加载失败', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) return <Loading text="加载计划…" />;
  if (!data) return <Empty title="计划不存在" />;

  const tasks = stats?.tasks || data.tasks || [];
  const pct =
    stats?.progress_percent ??
    data.progress_percent ??
    (tasks.length
      ? Math.round(
          tasks.reduce((s, x) => s + (Number(x.completed_percent) || 0), 0) /
            tasks.length
        )
      : 0);

  const onDelete = async () => {
    if (!window.confirm('确定删除该计划？关联会话的计划引用会被清空。')) return;
    try {
      await deleteSchedule(id);
      toast.success('已删除');
      nav('/schedules');
    } catch (e) {
      toast.error('删除失败', e.message);
    }
  };

  return (
    <div>
      <PageHeader
        title={data.title}
        sub={data.description || '无描述'}
        right={
          <div className="row">
            <Button variant="outline" onClick={() => nav(`/schedules/${id}/edit`)}>
              编辑
            </Button>
            <Button variant="accent" onClick={() => nav('/')}>
              去专注
            </Button>
          </div>
        }
      />

      <Card>
        <div className="label" style={{ color: t.textSecondary }}>
          时间段
        </div>
        <div style={{ color: t.text, fontWeight: 600 }}>
          {formatRange(data.start_at, data.end_at)}
        </div>
        <div className="label" style={{ color: t.textSecondary, marginTop: 14 }}>
          计划进度（任务平均完成度）
        </div>
        <div style={{ color: t.text, marginBottom: 8 }}>
          {pct}% · 实际专注{' '}
          {formatMinutes(
            stats?.actual_focused_minutes ?? data.actual_focused_minutes ?? 0
          )}
        </div>
        <ProgressBar current={pct} total={100} label="计划进度" />
        <div className="muted" style={{ color: t.muted, marginTop: 10 }}>
          番茄会话 {stats?.session_count ?? data.session_count ?? 0} 次 · 创建于{' '}
          {formatDateTime(data.created_at)}
        </div>
        <p className="muted" style={{ color: t.muted, marginTop: 8, marginBottom: 0 }}>
          进度仅能在「专注结束保存」时调整，详情页不可直接修改
        </p>
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 12px', color: t.text }}>任务与进度</h3>
        {tasks.length === 0 ? (
          <Empty title="无任务" />
        ) : (
          tasks.map((task) => {
            const tp = Number(task.completed_percent || 0);
            return (
              <div
                key={task.id}
                style={{
                  borderBottom: `1px solid ${t.border}`,
                  padding: '14px 0',
                }}
              >
                <div className="row-between">
                  <strong style={{ color: t.text }}>{task.description}</strong>
                  <span
                    style={{
                      color: t.accent,
                      background: t.primarySoft,
                      padding: '3px 8px',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    {task.planned_minutes} 分
                  </span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <ProgressBar current={tp} total={100} label={`完成 ${tp}%`} />
                </div>
              </div>
            );
          })
        )}
      </Card>

      <div style={{ marginTop: 16 }}>
        <Button variant="danger" onClick={onDelete}>
          删除计划
        </Button>
        <Button
          variant="ghost"
          style={{ marginLeft: 10 }}
          onClick={() => nav('/schedules')}
        >
          返回列表
        </Button>
      </div>
    </div>
  );
}
