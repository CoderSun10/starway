import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Customized,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../stores/themeStore';
import {
  fetchBySchedule,
  fetchDailyStats,
  fetchOverview,
  fetchSessionsPaged,
} from '../services/api';
import {
  formatDateTime,
  formatMinutes,
  formatMinutesVerbose,
  todayStr,
} from '../utils/time';
import { formatFen } from '../utils/money';
import {
  Button,
  Card,
  Chip,
  Empty,
  IconButton,
  Loading,
  PageHeader,
} from '../components/ui';
import { toast } from '../stores/toastStore';

const PIE_TOP = 5;
const CHART_H = 260;
/** 最近会话条数（按时间倒序最新 N 条，不是按天） */
const SESSION_PAGE = 20;

function Mins({ value }) {
  const m = Number(value) || 0;
  return (
    <span className="mins-tip" title={formatMinutesVerbose(m)}>
      {formatMinutes(m)}
    </span>
  );
}

/**
 * 平均数字画在 Y 轴刻度同一列。
 * 落在夹住平均值的两条刻度之间，并上下各留空隙，避免和 200/400 重叠。
 */
function AvgYNumber({ yAxisMap, offset, avg, fill, formatter }) {
  const n = Number(avg);
  if (!yAxisMap || !Number.isFinite(n) || n <= 0) return null;
  const axis = Object.values(yAxisMap)[0];
  if (!axis || typeof axis.scale !== 'function') return null;
  const ticks = [...new Set((axis.niceTicks || axis.ticks || []).map(Number))]
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  const yLine = axis.scale(n);
  if (!Number.isFinite(yLine)) return null;

  let lo = ticks.length ? ticks[0] : null;
  let hi = ticks.length ? ticks[ticks.length - 1] : null;
  for (let i = 0; i < ticks.length - 1; i += 1) {
    if (n >= ticks[i] && n <= ticks[i + 1]) {
      lo = ticks[i];
      hi = ticks[i + 1];
      break;
    }
  }
  const yA = lo == null ? offset?.top : axis.scale(lo);
  const yB = hi == null ? (offset?.top || 0) + (offset?.height || 0) : axis.scale(hi);
  if (!Number.isFinite(yA) || !Number.isFinite(yB)) return null;
  const yTop = Math.min(yA, yB);
  const yBot = Math.max(yA, yB);
  const pad = 13;
  let y = yLine;
  if (yBot - yTop > pad * 2) {
    y = Math.min(yBot - pad, Math.max(yTop + pad, yLine));
  } else {
    y = (yTop + yBot) / 2;
  }

  const x = (axis.x || 0) + (axis.width || 0);
  const text = formatter ? formatter(Math.round(n)) : String(Math.round(n));
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fontSize={11}
      fontWeight={700}
      fill={fill}
    >
      {text}
    </text>
  );
}

function ChartPanel({ title, children, empty, emptyTitle, emptySub }) {
  const t = useTheme();
  return (
    <Card>
      <h3 className="chart-card-title" style={{ color: t.text }}>
        {title}
      </h3>
      <div className="chart-box">
        {empty ? <Empty title={emptyTitle} subtitle={emptySub} /> : children}
      </div>
    </Card>
  );
}

/** 饼图悬停：扇区外扩 + 轻微加亮 */
function renderActiveShape(props) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    midAngle,
  } = props;
  const RADIAN = Math.PI / 180;
  const ox = Math.cos(-RADIAN * midAngle) * 6;
  const oy = Math.sin(-RADIAN * midAngle) * 6;

  return (
    <g style={{ outline: 'none' }}>
      <Sector
        cx={cx + ox}
        cy={cy + oy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="transparent"
        style={{
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.22))',
          outline: 'none',
        }}
      />
    </g>
  );
}

export default function StatsPage({ mode = 'focus' }) {
  const isMoney = mode === 'money';
  const t = useTheme();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [daily, setDaily] = useState([]);
  const [bySchedule, setBySchedule] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionLimit, setSessionLimit] = useState(SESSION_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pieHover, setPieHover] = useState(null);
  const [pieSelected, setPieSelected] = useState(null);
  const pieActive = pieHover ?? pieSelected;

  const load = useCallback(async () => {
    const today = todayStr();
    try {
      const [ov, d, bs, page] = await Promise.all([
        fetchOverview({ today }),
        fetchDailyStats({ days, today }),
        fetchBySchedule({ days, today }),
        fetchSessionsPaged({ limit: SESSION_PAGE }),
      ]);
      setOverview(ov);
      setDaily(d || []);
      setBySchedule(bs || []);
      setSessions(page.list);
      setSessionTotal(page.total);
      setSessionLimit(SESSION_PAGE);
    } catch (e) {
      toast.error('统计加载失败', e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  async function loadMoreSessions() {
    const next = sessionLimit + SESSION_PAGE;
    setLoadingMore(true);
    try {
      const page = await fetchSessionsPaged({ limit: next });
      setSessions(page.list);
      setSessionTotal(page.total);
      setSessionLimit(next);
    } catch (e) {
      toast.error('加载更多失败', e.message);
    } finally {
      setLoadingMore(false);
    }
  }



  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const barData = useMemo(
    () =>
      (daily || []).map((x) => ({
        day: String(x.day).slice(5),
        minutes: Number(x.total_minutes) || 0,
        spend_fen: Number(x.spend_fen) || 0,
      })),
    [daily]
  );

  const hasDaily = barData.some((x) => x.minutes > 0);
  const hasSpend = barData.some((x) => x.spend_fen > 0);
  const avgMinutes =
    barData.length > 0
      ? barData.reduce((s, x) => s + x.minutes, 0) / barData.length
      : 0;
  const avgSpend =
    barData.length > 0
      ? barData.reduce((s, x) => s + x.spend_fen, 0) / barData.length
      : 0;


  const pieData = useMemo(() => {
    const list = (bySchedule || []).filter((x) => Number(x.total_minutes) > 0);
    const top = list.slice(0, PIE_TOP);
    const rest = list.slice(PIE_TOP);
    const other = rest.reduce((s, x) => s + Number(x.total_minutes || 0), 0);
    const rows = top.map((x, i) => ({
      name: (x.schedule_title || '计划').slice(0, 10),
      value: x.total_minutes,
      color: t.chart[i % t.chart.length],
    }));
    if (other > 0) {
      rows.push({
        name: `其他(${rest.length})`,
        value: other,
        color: t.chart[t.chart.length - 1],
      });
    }
    return rows;
  }, [bySchedule, t.chart]);

  const tooltipStyle = {
    background: t.bgElevated,
    border: `1px solid ${t.border}`,
    borderRadius: 10,
    color: t.text,
  };

  if (loading && !overview) return <Loading text="加载统计…" />;

  const kpiItems = [
    {
      label: '今日',
      value: overview?.today_minutes || 0,
      sub: `${overview?.today_pomodoros || 0} 个番茄`,
    },
    {
      label: '本周',
      value: overview?.week_minutes || 0,
      sub: '本周累计',
    },
    {
      label: '本月',
      value: overview?.month_minutes || 0,
      sub: '本月累计',
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title={isMoney ? '用度统计' : '专注统计'}
        sub={
          isMoney
            ? `近 ${days} 天花费`
            : `图表：近 ${days} 天 · 会话可加载更多`
        }
        right={
          <Button
            variant="ghost"
            onClick={() => {
              setLoading(true);
              load();
            }}
          >
            刷新
          </Button>
        }
      />

      {!isMoney ? (
      <div className="kpi-row">
        {kpiItems.map((item) => (
          <Card key={item.label}>
            <div className="kpi-label" style={{ color: t.textSecondary }}>
              {item.label}
            </div>
            <div className="kpi-value" style={{ color: t.primary }}>
              <Mins value={item.value} />
            </div>
            <div className="kpi-sub" style={{ color: t.muted }}>
              {item.sub}
            </div>
          </Card>
        ))}
      </div>
      ) : (
      <div className="kpi-row">
        {[
          { label: '今日花费', value: overview?.today_spend_fen || 0 },
          { label: '本周花费', value: overview?.week_spend_fen || 0 },
          { label: '本月花费', value: overview?.month_spend_fen || 0 },
        ].map((item) => (
          <Card key={item.label}>
            <div className="kpi-label" style={{ color: t.textSecondary }}>
              {item.label}
            </div>
            <div className="kpi-value" style={{ color: t.accent }}>
              {formatFen(item.value)}
            </div>
          </Card>
        ))}
      </div>
      )}

      <div className="chip-row" style={{ marginBottom: 14 }}>
        {[7, 30].map((d) => (
          <Chip key={d} active={days === d} onClick={() => setDays(d)}>
            近 {d} 天
          </Chip>
        ))}
      </div>

      {!isMoney && (
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <ChartPanel title="每日专注（分钟）" empty={!hasDaily} emptyTitle="暂无柱状图数据">
          <div style={{ width: '100%', height: CHART_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke={t.textSecondary} fontSize={11} />
                <YAxis stroke={t.textSecondary} fontSize={11} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatMinutes(v), '专注']}
                  labelFormatter={(l) => `${l}`}
                  animationDuration={200}
                />
                <ReferenceLine
                  y={avgMinutes}
                  stroke={t.danger}
                  strokeDasharray="5 4"
                  strokeWidth={1.4}
                />
                <Customized
                  component={(props) => (
                    <AvgYNumber
                      {...props}
                      avg={avgMinutes}
                      fill={t.danger}
                    />
                  )}
                />
                <Bar
                  dataKey="minutes"
                  fill={t.primary}
                  radius={[6, 6, 0, 0]}
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="专注趋势" empty={!hasDaily} emptyTitle="暂无趋势数据">
          <div style={{ width: '100%', height: CHART_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={barData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke={t.textSecondary} fontSize={11} />
                <YAxis stroke={t.textSecondary} fontSize={11} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatMinutes(v), '专注']}
                  animationDuration={200}
                />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke={t.accent}
                  strokeWidth={2}
                  dot={{ r: 3, fill: t.primary }}
                  activeDot={{ r: 6, stroke: t.accent, strokeWidth: 2 }}
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>
      )}
      {isMoney && (
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <ChartPanel title="每日花费" empty={!hasSpend} emptyTitle="暂无花费数据">
          <div style={{ width: '100%', height: CHART_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke={t.textSecondary} fontSize={11} />
                <YAxis
                  stroke={t.textSecondary}
                  fontSize={11}
                  tickFormatter={(v) => formatFen(v)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatFen(v), '花费']}
                  animationDuration={200}
                />
                <ReferenceLine
                  y={avgSpend}
                  stroke={t.danger}
                  strokeDasharray="5 4"
                  strokeWidth={1.4}
                />
                <Customized
                  component={(props) => (
                    <AvgYNumber
                      {...props}
                      avg={avgSpend}
                      fill={t.danger}
                      formatter={(v) => formatFen(v)}
                    />
                  )}
                />
                <Bar
                  dataKey="spend_fen"
                  fill={t.accent}
                  radius={[6, 6, 0, 0]}
                  isAnimationActive
                  animationDuration={700}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
        <ChartPanel title="花费趋势" empty={!hasSpend} emptyTitle="暂无花费趋势">
          <div style={{ width: '100%', height: CHART_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={barData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke={t.textSecondary} fontSize={11} />
                <YAxis
                  stroke={t.textSecondary}
                  fontSize={11}
                  tickFormatter={(v) => formatFen(v)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatFen(v), '花费']}
                />
                <Line
                  type="monotone"
                  dataKey="spend_fen"
                  stroke={t.accent}
                  strokeWidth={2}
                  dot={{ r: 3, fill: t.accent }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>
      )}

      {!isMoney && (
      <div>
      <Card style={{ marginBottom: 14 }}>
        <h3 className="chart-card-title" style={{ color: t.text }}>
          按计划时长分布（近 {days} 天）
        </h3>
        <p className="muted" style={{ color: t.muted, margin: '0 0 12px' }}>
          Top {PIE_TOP} + 其他 · 右侧为常显图例（无需悬停）
        </p>
        {pieData.length > 0 ? (
          (() => {
            const total = pieData.reduce((s, x) => s + Number(x.value || 0), 0) || 1;
            return (
              <div
                className="pie-with-legend"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(240px, 1fr) minmax(220px, 1fr)',
                  gap: 20,
                  alignItems: 'center',
                  minHeight: 300,
                }}
              >
                {/* 左侧饼图 */}
                <div style={{ width: '100%', height: 300, outline: 'none' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart style={{ outline: 'none' }}>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={105}
                        activeIndex={pieActive ?? undefined}
                        activeShape={renderActiveShape}
                        onMouseEnter={(_, i) => setPieHover(i)}
                        onMouseLeave={() => setPieHover(null)}
                        onClick={(_, i, e) => {
                          e?.preventDefault?.();
                          e?.stopPropagation?.();
                          setPieSelected((cur) => (cur === i ? null : i));
                        }}
                        isAnimationActive
                        animationBegin={0}
                        animationDuration={900}
                        animationEasing="ease-out"
                        style={{ outline: 'none' }}
                      >
                        {pieData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.color}
                            stroke="transparent"
                            style={{
                              outline: 'none',
                              cursor: 'pointer',
                              opacity:
                                pieActive == null || pieActive === i ? 1 : 0.4,
                              transition: 'opacity 0.35s ease',
                            }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* 右侧常显图例：色块 + 名称 + 分钟 + 占比 */}
                <div className="pie-legend" style={{ height: 300, maxHeight: 300 }}>
                  <div className="pie-legend-head" style={{ color: t.textSecondary }}>
                    图例说明
                  </div>
                  <div className="pie-legend-list">
                  {pieData.map((item, i) => {
                    const pct = Math.round((Number(item.value) / total) * 100);
                    const active = pieActive === i;
                    return (
                      <div
                        key={`${item.name}-${i}`}
                        onMouseEnter={() => setPieHover(i)}
                        onMouseLeave={() => setPieHover(null)}
                        onClick={() =>
                          setPieSelected((cur) => (cur === i ? null : i))
                        }
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '14px 1fr auto',
                          gap: 10,
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: `1px solid ${active ? item.color : t.border}`,
                          background: active ? t.primarySoft : 'transparent',
                          cursor: 'default',
                          transition: 'border-color 0.3s ease, background 0.3s ease',
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 3,
                            background: item.color,
                            flexShrink: 0,
                            boxShadow: active
                              ? `0 0 0 2px ${item.color}55`
                              : 'none',
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              color: t.text,
                              fontWeight: 600,
                              fontSize: 13,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={item.name}
                          >
                            {item.name}
                          </div>
                          <div
                            className="muted"
                            style={{ color: t.muted, fontSize: 11, marginTop: 2 }}
                            title={formatMinutesVerbose(item.value)}
                          >
                            占比 {pct}%
                          </div>
                        </div>
                        <div
                          style={{
                            color: t.accent,
                            fontWeight: 700,
                            fontSize: 13,
                            whiteSpace: 'nowrap',
                          }}
                          title={formatMinutesVerbose(item.value)}
                        >
                          {formatMinutes(item.value)}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                  <div
                    className="pie-legend-foot"
                    style={{
                      borderTop: `1px solid ${t.border}`,
                      color: t.textSecondary,
                    }}
                  >
                    <span>合计</span>
                    <strong style={{ color: t.primary }} title={formatMinutesVerbose(total)}>
                      {formatMinutes(total)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="chart-box" style={{ height: 240, minHeight: 240, maxHeight: 240 }}>
            <Empty
              title="暂无关联计划的会话"
              subtitle="结束专注时选择关联计划即可"
            />
          </div>
        )}
      </Card>

      <Card>
        <h3 className="chart-card-title" style={{ color: t.text }}>
          最近会话
        </h3>
        <p className="muted" style={{ color: t.muted, margin: '0 0 10px' }}>
          默认最近 {SESSION_PAGE} 条，可继续加载 · 按时长倒序
        </p>
        {sessions.length === 0 ? (
          <Empty title="还没有专注记录" />
        ) : (
          <table className="table-like">
            <thead>
              <tr>
                <th style={{ borderColor: t.border, color: t.textSecondary }}>
                  内容
                </th>
                <th style={{ borderColor: t.border, color: t.textSecondary }}>
                  时长
                </th>
                <th style={{ borderColor: t.border, color: t.textSecondary }}>
                  时间
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ borderColor: t.border, color: t.text }}>
                    {s.schedule_title || s.content || '自由专注'}
                    {s.task_description ? (
                      <div className="muted" style={{ color: t.muted }}>
                        任务：{s.task_description}
                      </div>
                    ) : null}
                  </td>
                  <td
                    style={{
                      borderColor: t.border,
                      color: t.accent,
                      fontWeight: 700,
                    }}
                  >
                    <Mins value={s.duration_minutes} />
                  </td>
                  <td
                    style={{ borderColor: t.border, color: t.textSecondary }}
                  >
                    {formatDateTime(s.started_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sessions.length > 0 ? (
          <div className="session-more">
            {sessions.length < sessionTotal ? (
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={loadMoreSessions}
              >
                {loadingMore ? '加载中…' : `显示更多（${sessions.length}/${sessionTotal}）`}
              </Button>
            ) : (
              <p className="muted" style={{ color: t.muted, margin: '8px 0' }}>
                已经全部显示，没有更多了
              </p>
            )}
            {sessionLimit > SESSION_PAGE ? (
              <IconButton
                name="fold"
                title="收起"
                onClick={() => {
                  setSessions((prev) => prev.slice(0, SESSION_PAGE));
                  setSessionLimit(SESSION_PAGE);
                }}
              />
            ) : null}
          </div>
        ) : null}
      </Card>
      </div>
      )}
    </div>
  );
}
