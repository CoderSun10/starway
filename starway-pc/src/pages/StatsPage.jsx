import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useSettingsStore } from '../stores/settingsStore';
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
  TextInput,
} from '../components/ui';
import { toast } from '../stores/toastStore';
import ContextMenu from '../components/ContextMenu';

const PIE_TOP = 5;
const CHART_H = 260;
/** 最近会话条数（按时间倒序最新 N 条，不是按天） */
const SESSION_PAGE = 20;

/** YYYY-MM-DD 平移 n 天 */
function shiftYmd(ymd, n) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** 该北京日历日所在周的周一 */
function mondayOfYmd(ymd) {
  const dow = (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;
  return shiftYmd(ymd, -dow);
}

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

/** 顶部圆角的柱形路径，和 recharts radius={[6,6,0,0]} 的样子一致 */
function topRoundedPath(x, y, w, h, r) {
  if (h <= 0 || w <= 0) return null;
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return (
    `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} ` +
    `L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
  );
}

/**
 * 用度统计的柱子：
 * 先画一根从 0 到「合计」的柱子（蓝），再把「记账」那根绿柱压在上面，
 * 于是只有固定支出那一段露在绿色上面。宽度、圆角都和原来一致。
 */
function SpendBar({
  plainColor,
  totalColor,
  x,
  y,
  width,
  height,
  payload,
}) {
  const total = Number(payload?.spend_fen) || 0;
  if (total <= 0 || height <= 0) return null;
  const plain = Number(payload?.plain_fen) || 0;
  const plainH = Math.max(0, Math.min(height, (plain / total) * height));
  const plainY = y + height - plainH;
  return (
    <g>
      <path d={topRoundedPath(x, y, width, height, 6)} fill={totalColor} />
      <path d={topRoundedPath(x, plainY, width, plainH, 6)} fill={plainColor} />
    </g>
  );
}

export default function StatsPage({ mode = 'focus' }) {
  const isMoney = mode === 'money';
  const t = useTheme();
  const includeFixed = useSettingsStore((s) => s.statsIncludeFixed);
  const setIncludeFixed = useSettingsStore((s) => s.setStatsIncludeFixed);
  // 图表时段：week=本周 month=本月 d7=近7天 d30=近30天 custom=自定义
  const [rangeKey, setRangeKey] = useState('week');
  const [moreOpen, setMoreOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(() => shiftYmd(todayStr(), -13));
  const [customTo, setCustomTo] = useState(todayStr());
  const [customDraft, setCustomDraft] = useState({ from: '', to: '' });
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
  // 右键菜单坐标；为 null 表示没打开
  const [menu, setMenu] = useState(null);
  const moreRef = useRef(null);

  // 点「更多」下拉外部时收起
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDown = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [moreOpen]);

  const today = todayStr();
  const range = useMemo(() => {
    if (rangeKey === 'month') {
      // 整月框架：1 号到月末，未来日期留空不截断
      const [y, m] = today.slice(0, 7).split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return {
        from: `${today.slice(0, 7)}-01`,
        to: `${today.slice(0, 7)}-${String(last).padStart(2, '0')}`,
        label: '本月',
      };
    }
    if (rangeKey === 'd7') {
      return { from: shiftYmd(today, -6), to: today, label: '近 7 天' };
    }
    if (rangeKey === 'd30') {
      return { from: shiftYmd(today, -29), to: today, label: '近 30 天' };
    }
    if (rangeKey === 'custom') {
      return { from: customFrom, to: customTo, label: '自定义' };
    }
    // 本周：周一到周日完整 7 天
    const mon = mondayOfYmd(today);
    return { from: mon, to: shiftYmd(mon, 6), label: '本周' };
  }, [rangeKey, today, customFrom, customTo]);

  const load = useCallback(async () => {
    const todayLocal = todayStr();
    try {
      const [ov, d, bs, page] = await Promise.all([
        fetchOverview({
          today: todayLocal,
          ...(isMoney && includeFixed ? { include_fixed: 1 } : {}),
        }),
        fetchDailyStats({
          from: range.from,
          to: range.to,
          today: todayLocal,
          // 固定支出只影响花费，专注统计用不到
          ...(isMoney && includeFixed ? { include_fixed: 1 } : {}),
        }),
        fetchBySchedule({ from: range.from, to: range.to, today: todayLocal }),
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
  }, [range.from, range.to, isMoney, includeFixed]);

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
      (daily || []).map((x) => {
        const spend = Number(x.spend_fen) || 0;
        const fixed = Number(x.fixed_fen) || 0;
        return {
          day: String(x.day).slice(5),
          minutes: Number(x.total_minutes) || 0,
          spend_fen: spend,
          // 柱子叠两段：记账部分 + 固定支出部分
          fixed_fen: fixed,
          plain_fen: Math.max(spend - fixed, 0),
        };
      }),
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

  // 刷新按钮去掉了，改成右键菜单（桌面上本来也没有默认右键菜单）
  const openMenu = (e) => {
    e.preventDefault();
    const sel = window.getSelection?.()?.toString().trim() || '';
    setMenu({ x: e.clientX, y: e.clientY, sel });
  };

  const menuItems = [
    {
      id: 'refresh',
      label: '刷新',
      hint: '重新拉取',
      onSelect: () => {
        setLoading(true);
        load();
      },
    },
  ];
  if (menu?.sel) {
    menuItems.push({
      id: 'copy',
      label: '复制',
      hint: '选中内容',
      onSelect: () => {
        navigator.clipboard?.writeText(menu.sel).then(
          () => toast.success('已复制'),
          () => toast.error('复制失败')
        );
      },
    });
  }

  return (
    <div className="stack" onContextMenu={openMenu}>
      <PageHeader
        title={isMoney ? '用度统计' : '专注统计'}
        sub={
          isMoney
            ? `${range.label}花费（${range.from} ~ ${range.to}）`
            : `图表：${range.label} ${range.from} ~ ${range.to} · 会话可加载更多`
        }
        right={
          isMoney ? (
            <label
              className="row"
              title="把每月固定支出也计入花费"
              style={{
                gap: 8,
                fontSize: 13,
                color: t.textSecondary,
                cursor: 'pointer',
                userSelect: 'none',
                ['--settings-accent']: t.primary,
              }}
            >
              含固定支出
              <span className="settings-switch">
                <input
                  type="checkbox"
                  checked={!!includeFixed}
                  onChange={(e) => setIncludeFixed(e.target.checked)}
                />
                <i />
              </span>
            </label>
          ) : undefined
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

      <div className="chip-row" style={{ marginBottom: 14, alignItems: 'center' }}>
        <Chip
          active={rangeKey === 'week'}
          onClick={() => {
            setRangeKey('week');
            setMoreOpen(false);
          }}
        >
          本周
        </Chip>
        <Chip
          active={rangeKey === 'month'}
          onClick={() => {
            setRangeKey('month');
            setMoreOpen(false);
          }}
        >
          本月
        </Chip>
        <span style={{ flex: 1 }} />
        <div ref={moreRef} style={{ position: 'relative' }}>
          <Chip
            active={moreOpen || ['d7', 'd30', 'custom'].includes(rangeKey)}
            onClick={() => {
              setCustomDraft({ from: customFrom, to: customTo });
              setMoreOpen((v) => !v);
            }}
          >
            {['d7', 'd30', 'custom'].includes(rangeKey) ? range.label : '更多'}
          </Chip>
          {moreOpen ? (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                zIndex: 60,
                minWidth: 230,
                padding: 6,
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                background: t.bgElevated,
                boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
              }}
            >
              {[
                { k: 'd7', label: '近 7 天' },
                { k: 'd30', label: '近 30 天' },
              ].map((o) => (
                <button
                  key={o.k}
                  type="button"
                  className="ctx-item"
                  style={{ color: t.text }}
                  onClick={() => {
                    setRangeKey(o.k);
                    setMoreOpen(false);
                  }}
                >
                  <span>{o.label}</span>
                  {rangeKey === o.k ? (
                    <span className="ctx-hint">当前</span>
                  ) : null}
                </button>
              ))}
              <div
                style={{
                  borderTop: `1px solid ${t.border}`,
                  margin: '6px 0',
                }}
              />
              <div
                className="muted"
                style={{ color: t.textSecondary, fontSize: 12, padding: '0 10px 6px' }}
              >
                自定义时长
              </div>
              <div style={{ display: 'flex', gap: 6, padding: '0 6px' }}>
                <TextInput
                  type="date"
                  value={customDraft.from}
                  onChange={(e) =>
                    setCustomDraft((d) => ({ ...d, from: e.target.value }))
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
                <TextInput
                  type="date"
                  value={customDraft.to}
                  onChange={(e) =>
                    setCustomDraft((d) => ({ ...d, to: e.target.value }))
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
              <div style={{ padding: '6px 6px 2px' }}>
                <Button
                  variant="accent"
                  style={{ width: '100%' }}
                  onClick={() => {
                    const { from, to } = customDraft;
                    if (!from || !to || from > to) {
                      toast.error('请选择合法的起止日期');
                      return;
                    }
                    setCustomFrom(from);
                    setCustomTo(to);
                    setRangeKey('custom');
                    setMoreOpen(false);
                  }}
                >
                  应用
                </Button>
              </div>
            </div>
          ) : null}
        </div>
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
                <Bar
                  dataKey="minutes"
                  fill={t.primary}
                  radius={[6, 6, 0, 0]}
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
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
                  formatter={(v, _n, item) => {
                    const fixed = Number(item?.payload?.fixed_fen) || 0;
                    return [
                      formatFen(v),
                      fixed > 0 ? `花费（含固定 ${formatFen(fixed)}）` : '花费',
                    ];
                  }}
                  animationDuration={200}
                />
                <Bar
                  dataKey="spend_fen"
                  name="花费"
                  fill={t.accent}
                  shape={
                    <SpendBar plainColor={t.accent} totalColor={t.primary} />
                  }
                  isAnimationActive
                  animationDuration={700}
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
          按计划时长分布（{range.label}）
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

      <p
        className="muted"
        style={{
          color: t.muted,
          fontSize: 12,
          lineHeight: 1.7,
          margin: '4px 4px 0',
        }}
      >
        说明：专注时长只统计完整番茄钟的整块时间，不含碎片时间，并不等于当天实际学习或工作的总量。
        一天的充实感来自你对自己付出的认可，而不只来自一个未必完整的数字——不必为它纠结。
      </p>
      </div>
      )}
      <ContextMenu
        x={menu?.x}
        y={menu?.y}
        items={menuItems}
        onClose={() => setMenu(null)}
      />
    </div>
  );
}
