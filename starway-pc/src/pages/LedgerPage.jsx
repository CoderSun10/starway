import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import {
  fetchBudgetPeriods,
  fetchMonthBudgets,
  upsertMonthBudget,
} from '../services/api';
import { formatFen, yuanToFen } from '../utils/money';
import { todayStr } from '../utils/time';
import {
  Button,
  Card,
  Empty,
  Loading,
  NumericInput,
  PageHeader,
  ProgressBar,
} from '../components/ui';
import { toast } from '../stores/toastStore';

/** YYYY-MM → { start, end, label }（北京日历月） */
function monthFrame(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    month,
    label: `${y}年${m}月`,
    start: `${month}-01`,
    end: `${month}-${String(last).padStart(2, '0')}`,
  };
}

function PeriodItem({ p, list, t }) {
  return (
    <Link
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
        {p.start_date.slice(0, 7) !== p.end_date.slice(0, 7) ? ' · 跨月' : ''}
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
  );
}

export default function LedgerPage() {
  const t = useTheme();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [monthMap, setMonthMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [openMonths, setOpenMonths] = useState(() => new Set([todayStr().slice(0, 7)]));
  const [editingMonth, setEditingMonth] = useState(null);
  const [budgetYuan, setBudgetYuan] = useState('');
  const [savingMonth, setSavingMonth] = useState(false);

  const curMonth = todayStr().slice(0, 7);

  const load = useCallback(async () => {
    try {
      const periods = (await fetchBudgetPeriods(q.trim() ? { q: q.trim() } : {})) || [];
      setList(periods);
      // 月份框架：当月 + 各时段起始月 + 已存预算月
      const monthSet = new Set([curMonth]);
      for (const p of periods) monthSet.add(p.start_date.slice(0, 7));
      const budgets = (await fetchMonthBudgets([...monthSet])) || [];
      const map = {};
      for (const b of budgets) {
        map[b.month] = b;
        monthSet.add(b.month);
      }
      setMonthMap(map);
    } catch (e) {
      toast.error('加载账本失败', e.message);
    } finally {
      setLoading(false);
    }
  }, [q, curMonth]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const months = useMemo(() => {
    const s = new Set([curMonth]);
    for (const p of list) s.add(p.start_date.slice(0, 7));
    for (const m of Object.keys(monthMap)) s.add(m);
    return [...s].sort().reverse();
  }, [list, monthMap, curMonth]);

  function toggleMonth(m) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  async function saveMonthBudget(month) {
    const fen = yuanToFen(budgetYuan);
    if (fen == null) {
      toast.error('请填写合法预算金额');
      return;
    }
    setSavingMonth(true);
    try {
      const row = await upsertMonthBudget(month, fen);
      setMonthMap((prev) => ({ ...prev, [month]: row }));
      setEditingMonth(null);
      toast.success('已保存整体预算');
    } catch (e) {
      toast.error('保存失败', e.message);
    } finally {
      setSavingMonth(false);
    }
  }

  const searching = !!q.trim();

  return (
    <div>
      <PageHeader
        title="账本"
        sub="按月份框架记账；点开一个月展开里面的分段预算"
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
      ) : searching ? (
        list.length === 0 ? (
          <Card>
            <Empty title="没有匹配的预算时段" />
          </Card>
        ) : (
          list.map((p) => <PeriodItem key={p.id} p={p} list={list} t={t} />)
        )
      ) : (
        months.map((m) => {
          const frame = monthFrame(m);
          const info = monthMap[m];
          const planned = info?.planned_amount_fen;
          const spent = info?.spent_fen ?? 0;
          const children = list.filter((p) => p.start_date.slice(0, 7) === m);
          const open = openMonths.has(m);
          const editing = editingMonth === m;
          return (
            <Card key={m} style={{ marginBottom: 14 }}>
              <div
                className="row-between"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => !editing && toggleMonth(m)}
              >
                <div>
                  <strong style={{ fontSize: 16, color: t.text }}>{frame.label}</strong>
                  <span
                    className="muted"
                    style={{ color: t.textSecondary, marginLeft: 10, fontSize: 12 }}
                  >
                    {frame.start} ~ {frame.end}
                  </span>
                </div>
                <div className="row" style={{ gap: 12 }}>
                  {editing ? (
                    <span
                      className="row"
                      style={{ gap: 6 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <NumericInput
                        integer={false}
                        min={0.01}
                        max={10000000}
                        value={budgetYuan}
                        onChange={setBudgetYuan}
                        onCommit={(n) => setBudgetYuan(String(n))}
                        style={{ width: 110 }}
                      />
                      <Button
                        variant="accent"
                        disabled={savingMonth}
                        onClick={() => saveMonthBudget(m)}
                      >
                        保存
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingMonth(null)}>
                        取消
                      </Button>
                    </span>
                  ) : (
                    <>
                      <span
                        title="双击修改整体预算"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingMonth(m);
                          setBudgetYuan(
                            planned != null ? String(planned / 100) : ''
                          );
                        }}
                        style={{
                          color: t.textSecondary,
                          fontSize: 13,
                          cursor: 'text',
                        }}
                      >
                        整体预算{' '}
                        <strong style={{ color: t.text }}>
                          {planned != null ? formatFen(planned) : '未设置'}
                        </strong>
                      </span>
                      <span style={{ color: t.accent, fontWeight: 700 }}>
                        已花 {formatFen(spent)}
                      </span>
                      <span
                        className={`nav-caret${open ? ' open' : ''}`}
                        style={{ color: t.textSecondary }}
                      >
                        ▸
                      </span>
                    </>
                  )}
                </div>
              </div>
              {planned != null ? (
                <div style={{ marginTop: 10 }}>
                  <ProgressBar
                    current={spent}
                    total={planned}
                    fill={t.accent}
                    tone={spent > planned ? 'danger' : undefined}
                    label={`当月花费 ${formatFen(spent)} / 预算 ${formatFen(planned)}${
                      spent > planned ? ` · 已超支 ${formatFen(spent - planned)}` : ''
                    }`}
                  />
                </div>
              ) : null}
              <div className={`ledger-sub-wrap${open ? ' open' : ''}`}>
                <div className="ledger-sub-inner">
                  <div style={{ marginTop: 12 }}>
                    {children.length === 0 ? (
                      <Empty
                        title="这个月还没有分段"
                        subtitle="按月内的时间段拆几个小账本，比如上半月 / 下半月"
                      />
                    ) : (
                      children.map((p) => <PeriodItem key={p.id} p={p} list={list} t={t} />)
                    )}
                    <div style={{ marginTop: 8 }}>
                      <Button
                        variant="ghost"
                        onClick={() => nav(`/ledger/new?month=${m}`)}
                      >
                        ＋ 添加分段
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
