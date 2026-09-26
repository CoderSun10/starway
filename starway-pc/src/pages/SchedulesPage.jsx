import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import { fetchSchedules } from '../services/api';
import { formatMinutes, formatRange } from '../utils/time';
import { Button, Card, Empty, Loading, PageHeader, ProgressBar } from '../components/ui';
import { toast } from '../stores/toastStore';

function ChildPlan({ s, t }) {
  const pct = s.progress_percent ?? 0;
  return (
    <Link
      to={`/schedules/${s.id}`}
      className="list-item"
      style={{
        borderColor: t.border,
        background: t.bgElevated,
        color: t.text,
      }}
    >
      <div className="row-between">
        <strong style={{ fontSize: 15 }}>{s.title}</strong>
        <span style={{ color: t.accent, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div className="muted" style={{ color: t.textSecondary, marginTop: 6 }}>
        {formatRange(s.start_at, s.end_at)} · 预计 {formatMinutes(s.planned_minutes)}
      </div>
      <div style={{ marginTop: 10 }}>
        <ProgressBar current={pct} total={100} />
      </div>
    </Link>
  );
}

export default function SchedulesPage() {
  const t = useTheme();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [childrenByParent, setChildrenByParent] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [openIds, setOpenIds] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      const params = q.trim() ? { q: q.trim() } : {};
      const [tops, leaves] = await Promise.all([
        fetchSchedules({ top: 1, ...params }),
        fetchSchedules({}),
      ]);
      const grouped = {};
      for (const row of leaves || []) {
        const parentId = Number(row.parent_id);
        if (!parentId) continue;
        if (!grouped[parentId]) grouped[parentId] = [];
        grouped[parentId].push(row);
      }
      setList(tops || []);
      setChildrenByParent(grouped);
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

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="计划"
        sub="点标题进入页面，点行的其他位置展开项目里的计划"
        right={
          <div className="row">
            <Button variant="ghost" onClick={() => nav('/schedules/new')}>
              新建计划
            </Button>
            <Button variant="accent" onClick={() => nav('/schedules/group/new')}>
              新建项目
            </Button>
          </div>
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
          <Empty title="暂无计划" subtitle="新建一条计划，或建一个自己定时间的项目" />
        </Card>
      ) : (
        list.map((s) => {
          const group = Number(s.is_group) === 1;
          const pct = s.progress_percent ?? 0;
          const open = openIds.has(s.id);
          const children = childrenByParent[s.id] || [];
          const openPage = () =>
            nav(group ? `/schedules/${s.id}/plan` : `/schedules/${s.id}`);
          return (
            <Card key={s.id} style={{ marginBottom: 14 }}>
              <div
                className="row-between"
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => (group ? toggle(s.id) : openPage())}
              >
                <div>
                  <strong
                    style={{ fontSize: 16, color: t.text }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openPage();
                    }}
                  >
                    {s.title}
                  </strong>
                  <span
                    className="muted"
                    style={{ color: t.textSecondary, marginLeft: 10, fontSize: 12 }}
                  >
                    {formatRange(s.start_at, s.end_at)} · 预计 {formatMinutes(s.planned_minutes)}
                    {group ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 8,
                          padding: '0 8px',
                          height: 18,
                          borderRadius: 9,
                          background: t.accent,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          lineHeight: 1,
                          verticalAlign: 'middle',
                        }}
                      >
                        模块
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <span style={{ color: t.accent, fontWeight: 700 }}>{pct}%</span>
                  {group ? (
                    <span
                      className={`nav-caret${open ? ' open' : ''}`}
                      style={{ color: t.textSecondary }}
                    >
                      ▸
                    </span>
                  ) : null}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <ProgressBar current={pct} total={100} />
              </div>
              {group ? (
                <div className={`ledger-sub-wrap${open ? ' open' : ''}`}>
                  <div className="ledger-sub-inner">
                    <div style={{ marginTop: 12 }}>
                      {children.length === 0 ? (
                        <Empty title="这里还没有计划" subtitle="点标题进入项目页添加" />
                      ) : (
                        children.map((child) => (
                          <ChildPlan key={child.id} s={child} t={t} />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })
      )}
    </div>
  );
}
