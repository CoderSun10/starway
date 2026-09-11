import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import { fetchBudgetPeriods, fetchDaySummary, fetchSchedules } from '../services/api';
import { formatFen } from '../utils/money';
import {
  eachUtcDate,
  formatMinutesCompact,
  todayStr,
  visibleMonthRange,
} from '../utils/time';
import { Chip, Loading, PageHeader } from '../components/ui';
import DayPlansPanel from '../components/DayPlansPanel';
import { toast } from '../stores/toastStore';
import { useSettingsStore } from '../stores/settingsStore';
import { heatFillSolid, heatPalette, heatStep, heatTextColor } from '../utils/calendarView';

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

export default function CalendarPage() {
  const t = useTheme();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = todayStr();
  const [y, m] = today.split('-').map(Number);
  const [year, setYear] = useState(y);
  const [month, setMonth] = useState(m);
  const [days, setDays] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(today);
  const [layer, setLayer] = useState('detail');
  const [kind, setKind] = useState('time');
  const heatmapTimeMax = useSettingsStore((s) => s.heatmapTimeMax);
  const heatmapSpendYuan = useSettingsStore((s) => s.heatmapSpendYuan);

  const range = useMemo(() => visibleMonthRange(year, month), [year, month]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, b, s] = await Promise.all([
        fetchDaySummary({ from: range.from, to: range.to }),
        fetchBudgetPeriods({ from: range.from, to: range.to }),
        fetchSchedules({
          from: `${range.from}T00:00:00+08:00`,
          to: `${range.to}T23:59:59+08:00`,
        }),
      ]);
      setDays(sum?.days || []);
      setBudgets(b || []);
      setSchedules(s || []);
    } catch (e) {
      toast.error('月历加载失败', e.message);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    const q = params.get('day');
    if (!q || !/^\d{4}-\d{2}-\d{2}$/.test(q)) return;
    const [qy, qm] = q.split('-').map(Number);
    setYear(qy);
    setMonth(qm);
    setSelected(q);
  }, [params]);

  const dayMap = useMemo(() => {
    const map = {};
    for (const d of days) map[d.day] = d;
    return map;
  }, [days]);

  const cells = useMemo(() => eachUtcDate(range.from, range.to), [range]);
  const monthLabel = `${year}年${month}月`;
  const heatMax = kind === 'money' ? heatmapSpendYuan : heatmapTimeMax;
  const palette = useMemo(
    () => heatPalette(t.primary, t.bgElevated),
    [t.primary, t.bgElevated]
  );

  function gotoMonth(ny, nm) {
    let y2 = ny;
    let m2 = nm;
    if (m2 < 1) {
      y2 -= 1;
      m2 = 12;
    }
    if (m2 > 12) {
      y2 += 1;
      m2 = 1;
    }
    setYear(y2);
    setMonth(m2);
  }

  function goToday() {
    setYear(y);
    setMonth(m);
    setSelected(today);
    setParams({});
  }

  function onSelect(day) {
    setSelected(day);
  }

  const weekRows = Math.max(4, Math.round(cells.length / 7));

  return (
    <div className="cal-page">
      <PageHeader title="日历" sub="点日期查看当天所属计划" />
      {loading && days.length === 0 ? (
        <Loading text="加载月历…" />
      ) : (
        <div className={`cal-stage${layer === 'heat' ? ' heat-only' : ''}`}>
          <div className="cal-table-wrap">
          <div className="cal-table">
            <div className="cal-month-bar" style={{ color: t.text }}>
              <button
                type="button"
                className="cal-arrow"
                onClick={() => gotoMonth(year, month - 1)}
                aria-label="上一月"
                style={{ color: t.text, borderColor: t.border }}
              >
                ‹
              </button>
              <button
                type="button"
                className="cal-month-title"
                onClick={goToday}
                title="回到今天"
                style={{ color: t.text }}
              >
                {monthLabel}
              </button>
              <button
                type="button"
                className="cal-arrow"
                onClick={() => gotoMonth(year, month + 1)}
                aria-label="下一月"
                style={{ color: t.text, borderColor: t.border }}
              >
                ›
              </button>
            </div>

            <div className="cal-switches">
              <div className="cal-switches-left">
                <Chip active={layer === 'detail'} onClick={() => setLayer('detail')}>
                  普通
                </Chip>
                <Chip active={layer === 'heat'} onClick={() => setLayer('heat')}>
                  热力图
                </Chip>
              </div>
              {layer === 'heat' ? (
                <div className="cal-switches-right">
                  <Chip active={kind === 'time'} onClick={() => setKind('time')}>
                    时间
                  </Chip>
                  <Chip active={kind === 'money'} onClick={() => setKind('money')}>
                    用度
                  </Chip>
                </div>
              ) : null}
            </div>

            <div className="cal-week">
              {WEEK.map((w) => (
                <div key={w} className="cal-week-h" style={{ color: t.muted }}>
                  {w}
                </div>
              ))}
            </div>
            <div
              className="cal-grid"
              style={{ gridTemplateRows: `repeat(${weekRows}, minmax(0, 1fr))` }}
            >
              {cells.map((day) => {
                const inMonth = day.startsWith(
                  `${year}-${String(month).padStart(2, '0')}`
                );
                const rec = dayMap[day];
                const isSel = day === selected;
                const isTodayCell = day === today;
                const raw =
                  kind === 'money'
                    ? (rec?.spend_fen || 0) / 100
                    : rec?.focus_minutes || 0;
                const step =
                  layer === 'heat' ? heatStep(raw, heatMax) : 0;
                const bg =
                  layer === 'heat'
                    ? heatFillSolid(raw, heatMax, t.primary, t.bgElevated)
                    : t.bgElevated;
                const heatInk = layer === 'heat' ? heatTextColor(step) : null;
                return (
                  <button
                    key={day}
                    type="button"
                    className="cal-cell"
                    onClick={() => onSelect(day)}
                    title={
                      layer === 'heat' && raw > 0
                        ? kind === 'money'
                          ? formatFen(rec.spend_fen)
                          : formatMinutesCompact(raw)
                        : undefined
                    }
                    style={{
                      opacity: inMonth ? 1 : 0.42,
                      background: bg,
                      borderColor: isSel ? t.primary : t.border,
                      outline: isTodayCell ? `2px solid ${t.primary}` : 'none',
                      color: heatInk || t.text,
                    }}
                  >
                    <span
                      className="cal-num"
                      style={{ fontWeight: isTodayCell ? 700 : 500 }}
                    >
                      {Number(day.slice(8, 10))}
                    </span>
                    {layer === 'detail' && rec?.focus_minutes > 0 ? (
                      <span className="cal-focus" style={{ color: t.primary }}>
                        {formatMinutesCompact(rec.focus_minutes)}
                      </span>
                    ) : null}
                    {layer === 'detail' && rec?.spend_fen > 0 ? (
                      <span className="cal-spend" style={{ color: t.accent }}>
                        {formatFen(rec.spend_fen)}
                      </span>
                    ) : null}
                    {layer === 'heat' && raw > 0 ? (
                      <span className="cal-heat-val">
                        {kind === 'money'
                          ? formatFen(rec.spend_fen)
                          : formatMinutesCompact(raw)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {layer === 'heat' ? (
              <div className="cal-legend" style={{ color: t.muted }}>
                <span>少</span>
                {palette.map((c, i) => (
                  <i
                    key={i}
                    className="cal-heat-swatch"
                    style={{ background: c, borderColor: t.border }}
                    title={
                      i === 0
                        ? '无'
                        : `约 ${Math.round((i / 5) * heatMax)}${
                            kind === 'money' ? ' 元' : ' 分钟'
                          }`
                    }
                  />
                ))}
                <span>多</span>
                <span>
                  满格 {kind === 'money' ? `¥${heatMax}` : `${heatMax} 分钟`}
                </span>
                <button
                  type="button"
                  className="cal-legend-link"
                  onClick={() => nav('/settings')}
                  style={{ color: t.primary }}
                >
                  改阈值
                </button>
              </div>
            ) : null}
          </div>
          </div>
          <div className="cal-side">
            <DayPlansPanel
              day={selected}
              schedules={schedules}
              budgets={budgets}
              summary={dayMap[selected]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
