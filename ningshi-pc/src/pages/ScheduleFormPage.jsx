import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';
import {
  createSchedule,
  fetchSchedule,
  updateSchedule,
} from '../services/api';
import {
  localInputToUtcIso,
  nowInShanghai,
  utcToLocalInput,
} from '../utils/time';
import {
  Button,
  Card,
  Field,
  Loading,
  PageHeader,
  TextArea,
  TextInput,
} from '../components/ui';
import { toast } from '../stores/toastStore';

function emptyTask() {
  return { taskId: null, description: '', planned_minutes: 30, completed_percent: 0 };
}

export default function ScheduleFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const t = useTheme();
  const nav = useNavigate();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startLocal, setStartLocal] = useState(
    () => nowInShanghai().format('YYYY-MM-DDTHH:mm')
  );
  const [endLocal, setEndLocal] = useState(
    () => nowInShanghai().add(2, 'hour').format('YYYY-MM-DDTHH:mm')
  );
  const [plannedHours, setPlannedHours] = useState(1);
  const [plannedMins, setPlannedMins] = useState(0);
  const [tasks, setTasks] = useState([emptyTask()]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const data = await fetchSchedule(id);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setStartLocal(utcToLocalInput(data.start_at));
        setEndLocal(utcToLocalInput(data.end_at));
        const pm = Number(data.planned_minutes) || 0;
        setPlannedHours(Math.floor(pm / 60));
        setPlannedMins(pm % 60);
        setTasks(
          (data.tasks || []).map((x) => ({
            taskId: x.id,
            description: x.description,
            planned_minutes: x.planned_minutes,
            completed_percent: Number(x.completed_percent || 0),
          }))
        );
      } catch (e) {
        toast.error('加载失败', e.message);
        nav('/schedules');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, nav]);

  const totalPlanned = (Number(plannedHours) || 0) * 60 + (Number(plannedMins) || 0);
  const taskSum = useMemo(
    () => tasks.reduce((s, x) => s + (Number(x.planned_minutes) || 0), 0),
    [tasks]
  );
  const match = totalPlanned > 0 && taskSum === totalPlanned;

  const onSave = async () => {
    if (!title.trim()) {
      toast.error('请填写标题');
      return;
    }
    if (!match) {
      toast.error('任务时长之和必须等于预计总工时');
      return;
    }
    if (new Date(endLocal).getTime() <= new Date(startLocal).getTime()) {
      toast.error('结束时间必须晚于开始时间');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      start_at: localInputToUtcIso(startLocal),
      end_at: localInputToUtcIso(endLocal),
      planned_minutes: totalPlanned,
      tasks: tasks.map((x, i) => ({
        ...(x.taskId ? { id: x.taskId } : {}),
        description: String(x.description || '').trim(),
        planned_minutes: Number(x.planned_minutes),
        sort_order: i,
        completed_percent: Number(x.completed_percent || 0),
      })),
    };

    if (payload.tasks.some((x) => !x.description)) {
      toast.error('任务描述不能为空');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateSchedule(id, payload);
        toast.success('计划已更新');
        nav(`/schedules/${id}`);
      } else {
        const created = await createSchedule(payload);
        toast.success('计划已创建');
        nav(`/schedules/${created.id}`);
      }
    } catch (e) {
      toast.error('保存失败', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading text="加载表单…" />;

  return (
    <div>
      <PageHeader
        title={isEdit ? '编辑计划' : '新建计划'}
        sub="任务时长合计须等于预计总工时；编辑时保留任务进度"
      />

      <Card>
        <Field label="标题 *">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：冲刺里程碑" />
        </Field>
        <Field label="描述">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" />
        </Field>
      </Card>

      <Card>
        <div className="grid-2">
          <Field label="开始（北京时间）">
            <TextInput type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          </Field>
          <Field label="结束（北京时间，可跨天）">
            <TextInput type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <Field label="预计总工时">
          <div className="row">
            <TextInput
              type="number"
              min={0}
              style={{ maxWidth: 100 }}
              value={plannedHours}
              onChange={(e) => setPlannedHours(e.target.value)}
            />
            <span style={{ color: t.textSecondary }}>小时</span>
            <TextInput
              type="number"
              min={0}
              max={59}
              style={{ maxWidth: 100 }}
              value={plannedMins}
              onChange={(e) => setPlannedMins(e.target.value)}
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
          <h3 style={{ margin: 0, color: t.text }}>任务列表</h3>
          <Button
            variant="ghost"
            onClick={() => setTasks((arr) => [...arr, emptyTask()])}
          >
            + 添加任务
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
          任务合计 {taskSum} 分 / 总工时 {totalPlanned} 分
          {match ? ' ✓' : ' — 必须相等才能保存'}
        </div>

        {tasks.map((task, index) => (
          <div
            key={index}
            style={{
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 10,
              background: t.inputBg,
            }}
          >
            <div className="row-between" style={{ marginBottom: 8 }}>
              <strong style={{ color: t.text }}>任务 {index + 1}</strong>
              {tasks.length > 1 ? (
                <Button
                  variant="ghost"
                  onClick={() => setTasks((arr) => arr.filter((_, i) => i !== index))}
                >
                  删除
                </Button>
              ) : null}
            </div>
            <Field label="描述">
              <TextInput
                value={task.description}
                onChange={(e) => {
                  const v = e.target.value;
                  setTasks((arr) =>
                    arr.map((x, i) => (i === index ? { ...x, description: v } : x))
                  );
                }}
              />
            </Field>
            <Field label="预计分钟">
              <TextInput
                type="number"
                min={1}
                style={{ maxWidth: 120 }}
                value={task.planned_minutes}
                onChange={(e) => {
                  const v = e.target.value;
                  setTasks((arr) =>
                    arr.map((x, i) =>
                      i === index ? { ...x, planned_minutes: Number(v) } : x
                    )
                  );
                }}
              />
            </Field>
            {isEdit && task.taskId ? (
              <p className="muted" style={{ color: t.muted, margin: '0 0 4px', fontSize: 12 }}>
                当前完成度 {Number(task.completed_percent) || 0}%（仅展示，请在专注结束后调整）
              </p>
            ) : null}
          </div>
        ))}
      </Card>

      <div className="row" style={{ marginTop: 16 }}>
        <Button variant="accent" disabled={!match || saving} onClick={onSave}>
          {saving ? '保存中…' : isEdit ? '保存修改' : '创建计划'}
        </Button>
        <Button variant="ghost" onClick={() => nav(-1)}>
          取消
        </Button>
      </div>
    </div>
  );
}
