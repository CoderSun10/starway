import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import {
  createFocusGroup,
  deleteSchedule,
  fetchFocusGroup,
  updateFocusGroup,
} from '../services/api';
import {
  localInputToUtcIso,
  nowInShanghai,
  utcToLocalInput,
} from '../utils/time';
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  NumericInput,
  PageHeader,
  TextArea,
  TextInput,
} from '../components/ui';
import { toast } from '../stores/toastStore';

let keySeq = 1;
function nextKey() {
  keySeq += 1;
  return `p-${keySeq}`;
}

function emptyTask() {
  return { taskId: null, description: '', planned_minutes: 30, completed_percent: 0 };
}

function emptyPlan(startLocal) {
  const start = startLocal || nowInShanghai().format('YYYY-MM-DDTHH:mm');
  const end = nowInShanghai().add(1, 'hour').format('YYYY-MM-DDTHH:mm');
  return {
    key: nextKey(),
    id: null,
    title: '',
    description: '',
    startLocal: start,
    endLocal: startLocal ? endFrom(startLocal) : end,
    tasks: [emptyTask()],
  };
}

function endFrom(startLocal) {
  const m = nowInShanghai();
  const base = startLocal && startLocal.length >= 16 ? startLocal : m.format('YYYY-MM-DDTHH:mm');
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return m.add(1, 'hour').format('YYYY-MM-DDTHH:mm');
  d.setMinutes(d.getMinutes() + 60);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function planMinutes(plan) {
  return (plan.tasks || []).reduce((s, t) => s + (Number(t.planned_minutes) || 0), 0);
}

function isBlankPlan(plan) {
  if (plan.id) return false;
  if (String(plan.title || '').trim()) return false;
  return (plan.tasks || []).every((task) => !String(task.description || '').trim());
}

export default function FocusPlanPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const t = useTheme();
  const nav = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startLocal, setStartLocal] = useState(() => nowInShanghai().format('YYYY-MM-DDTHH:mm'));
  const [endLocal, setEndLocal] = useState(() => nowInShanghai().add(7, 'day').format('YYYY-MM-DDTHH:mm'));
  const [plannedHours, setPlannedHours] = useState(1);
  const [plannedMins, setPlannedMins] = useState(0);
  const [plans, setPlans] = useState(() => [emptyPlan(nowInShanghai().format('YYYY-MM-DDTHH:mm'))]);
  const [loadedIds, setLoadedIds] = useState([]);
  const [openKeys, setOpenKeys] = useState(() => new Set(plans.map((p) => p.key)));

  const load = useCallback(async () => {
    if (!isEdit) return;
    try {
      const data = await fetchFocusGroup(id);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setStartLocal(utcToLocalInput(data.start_at));
      setEndLocal(utcToLocalInput(data.end_at));
      const pm = Number(data.planned_minutes) || 0;
      setPlannedHours(Math.floor(pm / 60));
      setPlannedMins(pm % 60);
      const next = (data.plans || []).map((p) => ({
        key: `s-${p.id}`,
        id: p.id,
        title: p.title || '',
        description: p.description || '',
        startLocal: utcToLocalInput(p.start_at),
        endLocal: utcToLocalInput(p.end_at),
        tasks: (p.tasks || []).map((task) => ({
          taskId: task.id,
          description: task.description,
          planned_minutes: task.planned_minutes,
          completed_percent: Number(task.completed_percent || 0),
        })),
      }));
      setLoadedIds(next.map((p) => p.id));
      setPlans(next.length ? next : [emptyPlan(utcToLocalInput(data.start_at))]);
    } catch (e) {
      toast.error('加载失败', e.message);
      nav('/schedules');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, nav]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPlanned = (Number(plannedHours) || 0) * 60 + (Number(plannedMins) || 0);
  const activePlans = useMemo(() => plans.filter((p) => !isBlankPlan(p)), [plans]);
  const planSum = useMemo(
    () => activePlans.reduce((s, p) => s + planMinutes(p), 0),
    [activePlans]
  );
  const match = activePlans.length === 0 || (totalPlanned > 0 && planSum === totalPlanned);

  function togglePlan(key) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addPlan() {
    const p = emptyPlan(startLocal);
    setPlans((arr) => [...arr, p]);
    setOpenKeys((prev) => new Set(prev).add(p.key));
  }

  function patchPlan(key, patch) {
    setPlans((arr) => arr.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function patchTask(planKey, index, patch) {
    setPlans((arr) =>
      arr.map((p) => {
        if (p.key !== planKey) return p;
        return {
          ...p,
          tasks: p.tasks.map((task, i) => (i === index ? { ...task, ...patch } : task)),
        };
      })
    );
  }

  async function onSave() {
    if (!title.trim()) {
      toast.error('请填写标题');
      return;
    }
    if (new Date(endLocal).getTime() <= new Date(startLocal).getTime()) {
      toast.error('结束时间必须晚于开始时间');
      return;
    }
    const usable = plans.filter((p) => !isBlankPlan(p));
    if (usable.some((p) => !String(p.title || '').trim())) {
      toast.error('请填写每个计划的标题');
      return;
    }
    if (usable.length && planSum !== totalPlanned) {
      toast.error('计划里的任务时长之和必须等于项目的预计总工时');
      return;
    }
    const parentStart = new Date(startLocal).getTime();
    const parentEnd = new Date(endLocal).getTime();
    for (const p of usable) {
      const a = new Date(p.startLocal).getTime();
      const b = new Date(p.endLocal).getTime();
      if (!(b > a)) {
        toast.error(`「${p.title}」的结束时间必须晚于开始时间`);
        return;
      }
      if (a < parentStart || b > parentEnd) {
        toast.error(`「${p.title}」的时间必须落在项目之内`);
        return;
      }
      if (p.tasks.some((task) => !String(task.description || '').trim())) {
        toast.error(`「${p.title}」里还有空的任务描述`);
        return;
      }
    }
    const keepIds = new Set(usable.map((p) => p.id).filter(Boolean));
    const droppedCount = loadedIds.filter((x) => !keepIds.has(x)).length;
    if (droppedCount) {
      const ok = window.confirm(
        `将删除 ${droppedCount} 条计划，关联的番茄记录会保留但不再挂在计划上。继续保存？`
      );
      if (!ok) return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      start_at: localInputToUtcIso(startLocal),
      end_at: localInputToUtcIso(endLocal),
      planned_minutes: usable.length ? planSum : totalPlanned,
      plans: usable.map((p) => ({
        ...(p.id ? { id: p.id } : {}),
        title: p.title.trim(),
        description: String(p.description || '').trim() || null,
        start_at: localInputToUtcIso(p.startLocal),
        end_at: localInputToUtcIso(p.endLocal),
        tasks: p.tasks.map((task, i) => ({
          ...(task.taskId ? { id: task.taskId } : {}),
          description: String(task.description || '').trim(),
          planned_minutes: Number(task.planned_minutes),
          sort_order: i,
          completed_percent: Number(task.completed_percent || 0),
        })),
      })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateFocusGroup(id, payload);
        toast.success('项目已保存');
        await load();
      } else {
        const created = await createFocusGroup(payload);
        toast.success('项目已创建');
        nav(`/schedules/${created.id}/plan`, { replace: true });
      }
    } catch (e) {
      toast.error('保存失败', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!isEdit) return;
    if (!window.confirm('删除这个项目？里面的计划会一起删除，番茄记录会保留。')) return;
    try {
      await deleteSchedule(id);
      toast.success('已删除');
      nav('/schedules');
    } catch (e) {
      toast.error('删除失败', e.message);
    }
  }

  if (loading) return <Loading text="加载项目…" />;

  return (
    <div>
      <PageHeader
        title={isEdit ? '项目' : '新建项目'}
        sub="时间段自己定。下面是这个项目里的计划，任务分钟要凑满预计总工时"
        right={
          <Button variant="ghost" onClick={() => nav('/schedules')}>
            返回
          </Button>
        }
      />

      <Card>
        <Field label="标题 *">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：毕业设计" />
        </Field>
        <Field label="描述">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" />
        </Field>
        <div className="grid-2">
          <Field label="开始（北京时间）">
            <TextInput type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          </Field>
          <Field label="结束（北京时间）">
            <TextInput type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          </Field>
        </div>
        <Field label="预计总工时">
          <div className="row">
            <NumericInput
              min={0}
              max={999}
              style={{ maxWidth: 100 }}
              value={plannedHours}
              onChange={setPlannedHours}
              onCommit={setPlannedHours}
            />
            <span style={{ color: t.textSecondary }}>小时</span>
            <NumericInput
              min={0}
              max={59}
              style={{ maxWidth: 100 }}
              value={plannedMins}
              onChange={setPlannedMins}
              onCommit={setPlannedMins}
            />
            <span style={{ color: t.textSecondary }}>分钟</span>
            <span className="muted" style={{ color: t.muted }}>
              合计 {totalPlanned} 分
            </span>
          </div>
        </Field>
      </Card>

      <Card>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0, color: t.text }}>计划</h3>
          <Button variant="ghost" onClick={addPlan}>
            + 添加计划
          </Button>
        </div>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            marginBottom: 12,
            background: match ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            color: t.text,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          任务合计 {planSum} 分 / 项目 {totalPlanned} 分
          {match ? ' ✓' : ' — 必须相等才能保存'}
        </div>
        {plans.length === 0 ? (
          <Empty title="还没有计划" subtitle="可以先只保存项目，之后再加" />
        ) : null}
        {plans.map((plan) => {
          const open = openKeys.has(plan.key);
          return (
          <div
            key={plan.key}
            style={{
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              background: t.bgElevated,
            }}
          >
            <div
              className="row-between"
              style={{ cursor: 'pointer', userSelect: 'none', marginBottom: open ? 8 : 0 }}
              onClick={() => togglePlan(plan.key)}
            >
              <strong style={{ color: t.text }}>
                {plan.title || '未命名计划'}
                <span
                  className="muted"
                  style={{ color: t.textSecondary, marginLeft: 8, fontSize: 12, fontWeight: 400 }}
                >
                  {planMinutes(plan)} 分
                </span>
              </strong>
              <div className="row" onClick={(e) => e.stopPropagation()}>
                {plan.id ? (
                  <Link to={`/schedules/${plan.id}`} style={{ color: t.accent, fontSize: 13 }}>
                    查看进度
                  </Link>
                ) : null}
                {plans.length > 1 || plan.id ? (
                  <Button
                    variant="ghost"
                    onClick={() => setPlans((arr) => arr.filter((p) => p.key !== plan.key))}
                  >
                    删除
                  </Button>
                ) : null}
                <span
                  className={`nav-caret${open ? ' open' : ''}`}
                  style={{ color: t.textSecondary }}
                >
                  ▸
                </span>
              </div>
            </div>
            <div className={`ledger-sub-wrap${open ? ' open' : ''}`}>
              <div className="ledger-sub-inner">
            <Field label="标题">
              <TextInput
                value={plan.title}
                placeholder="例如：写开题报告"
                onChange={(e) => patchPlan(plan.key, { title: e.target.value })}
              />
            </Field>
            <div className="grid-2">
              <Field label="开始">
                <TextInput
                  type="datetime-local"
                  value={plan.startLocal}
                  onChange={(e) => patchPlan(plan.key, { startLocal: e.target.value })}
                />
              </Field>
              <Field label="结束">
                <TextInput
                  type="datetime-local"
                  value={plan.endLocal}
                  onChange={(e) => patchPlan(plan.key, { endLocal: e.target.value })}
                />
              </Field>
            </div>
            <div className="row-between" style={{ margin: '4px 0 8px' }}>
              <span style={{ color: t.textSecondary, fontSize: 13 }}>
                任务 · 本段 {planMinutes(plan)} 分钟
              </span>
              <Button
                variant="ghost"
                onClick={() => patchPlan(plan.key, { tasks: [...plan.tasks, emptyTask()] })}
              >
                + 任务
              </Button>
            </div>
            {plan.tasks.map((task, ti) => (
              <div
                key={`${plan.key}-${ti}`}
                style={{
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                  background: t.inputBg,
                }}
              >
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <span style={{ color: t.text, fontWeight: 600 }}>
                    {String(task.description || '').trim() || '未命名任务'}
                  </span>
                  {plan.tasks.length > 1 ? (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        patchPlan(plan.key, { tasks: plan.tasks.filter((_, i) => i !== ti) })
                      }
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
                <Field label="做什么">
                  <TextInput
                    value={task.description}
                    onChange={(e) => patchTask(plan.key, ti, { description: e.target.value })}
                  />
                </Field>
                <Field label="预计分钟">
                  <NumericInput
                    min={1}
                    max={24 * 60}
                    style={{ maxWidth: 120 }}
                    value={task.planned_minutes}
                    onChange={(v) => patchTask(plan.key, ti, { planned_minutes: v })}
                    onCommit={(n) => patchTask(plan.key, ti, { planned_minutes: n })}
                  />
                </Field>
                {task.taskId ? (
                  <p className="muted" style={{ color: t.muted, margin: 0, fontSize: 12 }}>
                    当前完成度 {Number(task.completed_percent) || 0}%（专注结束后再改）
                  </p>
                ) : null}
              </div>
            ))}
              </div>
            </div>
          </div>
          );
        })}
      </Card>

      <div className="row" style={{ marginTop: 16 }}>
        <Button variant="accent" disabled={!match || saving || totalPlanned <= 0} onClick={onSave}>
          {saving ? '保存中…' : isEdit ? '保存项目' : '创建项目'}
        </Button>
        <Button variant="ghost" onClick={() => nav('/schedules')}>
          取消
        </Button>
        {isEdit ? (
          <Button variant="danger" onClick={onDelete}>
            删除项目
          </Button>
        ) : null}
      </div>
    </div>
  );
}
