import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import { formatFen } from '../utils/money';
import { formatMinutes, formatMinutesCompact } from '../utils/time';
import { budgetCoversDay, scheduleCoversDay } from '../utils/calendarView';
import { ProgressBar } from './ui';

export default function DayPlansPanel({ day, schedules, budgets, summary }) {
  const t = useTheme();
  const nav = useNavigate();
  const timePlans = (schedules || []).filter((s) => scheduleCoversDay(s, day));
  const moneyPlans = (budgets || []).filter((p) => budgetCoversDay(p, day));

  const box = {
    background: t.bgElevated,
    borderColor: t.border,
    color: t.text,
  };

  const dayFocus = Number(summary?.focus_minutes) || 0;
  const daySpend = Number(summary?.spend_fen) || 0;
  const daySessions = Number(summary?.session_count) || 0;
  const dayExpenses = Number(summary?.expense_count) || 0;

  function goFocus() {
    nav('/focus');
  }

  return (
    <div className="day-plans">
      <div className="day-plans-date" style={{ color: t.text }}>
        {day}
      </div>

      <div className="day-plan-mod is-plans" style={box}>
        <div className="day-plan-kicker" style={{ color: t.textSecondary }}>
          当日计划
        </div>
        <div className="day-plan-stack">
          {timePlans.length === 0 && moneyPlans.length === 0 ? (
            <p className="day-plan-empty" style={{ color: t.muted }}>
              当天没有计划
            </p>
          ) : null}
          {timePlans.map((timePlan) => {
            const taskPct = Number(timePlan.progress_percent) || 0;
            const plannedMin = Number(timePlan.planned_minutes) || 0;
            const actualMin = Number(timePlan.actual_focused_minutes) || 0;
            const timePct =
              plannedMin > 0 ? Math.round((actualMin / plannedMin) * 100) : 0;
            return (
              <Link
                key={`t-${timePlan.id}`}
                to={`/schedules/${timePlan.id}`}
                className="day-plan-body"
              >
                <div className="day-plan-tag" style={{ color: t.primary }}>
                  时间
                </div>
                <h3 style={{ color: t.text }}>{timePlan.title}</h3>
                <div className="day-plan-bars">
                  <ProgressBar
                    label="任务进度"
                    current={taskPct}
                    total={100}
                    percent={taskPct}
                    fill={t.primary}
                  />
                  <ProgressBar
                    label="专注时长"
                    current={actualMin}
                    total={Math.max(plannedMin, 1)}
                    percent={timePct}
                    fill={t.accent}
                    tone={actualMin > plannedMin ? 'danger' : undefined}
                  />
                </div>
                <p className="day-plan-meta" style={{ color: t.textSecondary }}>
                  预计 {formatMinutes(plannedMin)}
                </p>
              </Link>
            );
          })}
          {timePlans.length > 0 && moneyPlans.length > 0 ? (
            <div className="day-plan-split" style={{ background: t.border }} />
          ) : null}
          {moneyPlans.map((moneyPlan) => (
            <Link
              key={`m-${moneyPlan.id}`}
              to={`/ledger/${moneyPlan.id}`}
              className="day-plan-body"
            >
              <div className="day-plan-tag" style={{ color: t.success }}>
                用度
              </div>
              <h3 style={{ color: t.text }}>{moneyPlan.title}</h3>
              <div className="day-plan-bars">
                <ProgressBar
                  label="花费进度"
                  current={moneyPlan.spent_fen}
                  total={Math.max(Number(moneyPlan.planned_amount_fen) || 1, 1)}
                  percent={Number(moneyPlan.progress_percent) || 0}
                  fill={t.accent}
                  tone={moneyPlan.overspent ? 'danger' : undefined}
                />
              </div>
              <p className="day-plan-meta" style={{ color: t.textSecondary }}>
                预计 {formatFen(moneyPlan.planned_amount_fen)}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="day-plan-mod is-work" style={box}>
        <div className="day-plan-kicker" style={{ color: t.textSecondary }}>
          当日成果
        </div>
        <div className="day-work">
          <div className="day-work-item">
            <div className="day-work-num" style={{ color: t.primary }}>
              {dayFocus > 0 ? formatMinutesCompact(dayFocus) : '0′'}
            </div>
            <div className="day-work-label" style={{ color: t.textSecondary }}>
              专注时间
            </div>
            <div className="muted" style={{ color: t.muted }}>
              {daySessions} 个番茄
            </div>
          </div>
          <div className="day-work-item">
            <div className="day-work-num" style={{ color: t.accent }}>
              {formatFen(daySpend)}
            </div>
            <div className="day-work-label" style={{ color: t.textSecondary }}>
              当日花费
            </div>
            <div className="muted" style={{ color: t.muted }}>
              {dayExpenses} 笔
            </div>
          </div>
        </div>
      </div>

      <div className="day-plan-actions">
        <button
          type="button"
          className="day-plan-btn"
          style={{ borderColor: t.border, color: t.text, background: t.bgElevated }}
          onClick={goFocus}
        >
          去专注
        </button>
        <button
          type="button"
          className="day-plan-btn"
          style={{ borderColor: t.border, color: t.text, background: t.bgElevated }}
          onClick={() =>
            nav({ pathname: '/money/journal', search: `?day=${day}` })
          }
        >
          去记账
        </button>
      </div>
    </div>
  );
}
