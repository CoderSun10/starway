import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Toast from 'react-native-toast-message';
import { spacing, radius } from '../constants/themes';
import { useTheme } from '../stores/themeStore';
import PrimaryButton from '../components/PrimaryButton';
import Card from '../components/Card';
import LoadingView from '../components/LoadingView';
import { createSchedule, updateSchedule, fetchSchedule } from '../services/api';
import { TIMEZONE } from '../stores/settingsStore';
import { toUtcIso, toDisplay, formatMinutes, nowInMode } from '../utils/time';

const schema = z
  .object({
    title: z.string().min(1, '请填写计划标题'),
    description: z.string().optional(),
    plannedHours: z.coerce.number().min(0).max(200),
    plannedMins: z.coerce.number().min(0).max(59),
    tasks: z
      .array(
        z.object({
          // 注意：不可用 id —— useFieldArray 会占用 id 作内部 key
          taskId: z.coerce.number().optional().nullable(),
          description: z.string().min(1, '任务描述不能为空'),
          planned_minutes: z.coerce.number().min(1, '至少 1 分钟'),
          completed_percent: z.coerce.number().min(0).max(100).optional(),
        })
      )
      .min(1, '至少添加一个任务'),
  })
  .superRefine((val, ctx) => {
    const total = Number(val.plannedHours) * 60 + Number(val.plannedMins);
    if (total <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '预计总工时必须大于 0',
        path: ['plannedHours'],
      });
    }
    const sum = val.tasks.reduce((s, t) => s + Number(t.planned_minutes || 0), 0);
    if (sum !== total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `任务时长之和(${sum}分)必须等于预计总工时(${total}分)`,
        path: ['tasks'],
      });
    }
  });

export default function ScheduleFormScreen({ navigation, route }) {
  const theme = useTheme();
  const editId = route.params?.id;
  const timezoneMode = TIMEZONE;
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(() => nowInMode(timezoneMode).toDate());
  const [endDate, setEndDate] = useState(() =>
    nowInMode(timezoneMode).add(2, 'hour').toDate()
  );
  const [picker, setPicker] = useState(null); // 'start' | 'end' | null

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      plannedHours: 1,
      plannedMins: 0,
      tasks: [{ description: '', planned_minutes: 30 }],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'tasks',
  });

  const plannedHours = watch('plannedHours');
  const plannedMins = watch('plannedMins');
  const tasks = watch('tasks');
  const totalPlanned = (Number(plannedHours) || 0) * 60 + (Number(plannedMins) || 0);
  const taskSum = (tasks || []).reduce(
    (s, t) => s + (Number(t.planned_minutes) || 0),
    0
  );
  const match = totalPlanned > 0 && taskSum === totalPlanned;

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const data = await fetchSchedule(editId);
        const pm = Number(data.planned_minutes) || 0;
        reset({
          title: data.title,
          description: data.description || '',
          plannedHours: Math.floor(pm / 60),
          plannedMins: pm % 60,
          tasks: (data.tasks || []).map((t) => ({
            taskId: t.id,
            description: t.description,
            planned_minutes: t.planned_minutes,
            // 编辑时带回进度，后端更新会保留
            completed_percent: Number(t.completed_percent || 0),
          })),
        });
        const s = toDisplay(data.start_at, timezoneMode);
        const e = toDisplay(data.end_at, timezoneMode);
        if (s) setStartDate(s.toDate());
        if (e) setEndDate(e.toDate());
      } catch (e) {
        Toast.show({ type: 'error', text1: '加载失败', text2: e.message });
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  /**
   * Android 不支持 mode="datetime"：
   * 组件卸载时会执行 pickers['datetime'].dismiss → Cannot read property 'dismiss' of undefined
   * 因此 Android 改为：先选日期，再选时间（命令式 API）
   */
  const openDateTimePicker = (which) => {
    const current = which === 'start' ? startDate : endDate;
    const apply = (d) => {
      if (which === 'start') setStartDate(d);
      else setEndDate(d);
    };

    if (Platform.OS === 'android') {
      try {
        DateTimePickerAndroid.open({
          value: current,
          mode: 'date',
          onChange: (event, datePart) => {
            if (!event || event.type === 'dismissed' || !datePart) return;
            try {
              DateTimePickerAndroid.open({
                value: datePart,
                mode: 'time',
                is24Hour: true,
                onChange: (event2, timePart) => {
                  if (!event2 || event2.type === 'dismissed' || !timePart) return;
                  const merged = new Date(datePart);
                  merged.setHours(
                    timePart.getHours(),
                    timePart.getMinutes(),
                    0,
                    0
                  );
                  apply(merged);
                },
              });
            } catch (e) {
              Toast.show({
                type: 'error',
                text1: '无法打开时间选择器',
                text2: e.message,
              });
            }
          },
        });
      } catch (e) {
        Toast.show({
          type: 'error',
          text1: '无法打开日期选择器',
          text2: e.message,
        });
      }
      return;
    }

    // iOS：用内联 spinner，mode 用 date + 再调一次 time 太繁琐，iOS 支持 datetime
    setPicker(which);
  };

  const onPickerChange = (event, selected) => {
    if (!event || event.type === 'dismissed') {
      setPicker(null);
      return;
    }
    if (!selected) return;
    if (picker === 'start') setStartDate(selected);
    if (picker === 'end') setEndDate(selected);
  };

  const onSubmit = async (values) => {
    if (endDate.getTime() <= startDate.getTime()) {
      Toast.show({ type: 'error', text1: '结束时间必须晚于开始时间（可跨天）' });
      return;
    }
    const planned_minutes =
      Number(values.plannedHours) * 60 + Number(values.plannedMins);
    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() || null,
      start_at: toUtcIso(startDate, timezoneMode),
      end_at: toUtcIso(endDate, timezoneMode),
      planned_minutes,
      tasks: values.tasks.map((t, i) => ({
        // 带上已有 taskId→id，后端按 id 更新，避免删建导致进度归零
        ...(t.taskId ? { id: Number(t.taskId) } : {}),
        description: t.description.trim(),
        planned_minutes: Number(t.planned_minutes),
        sort_order: i,
        completed_percent: Number(t.completed_percent || 0),
      })),
    };

    setSaving(true);
    try {
      if (editId) {
        await updateSchedule(editId, payload);
        Toast.show({ type: 'success', text1: '计划已更新' });
      } else {
        await createSchedule(payload);
        Toast.show({ type: 'success', text1: '计划已创建' });
      }
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: '保存失败', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = useMemo(
    () => ({
      start: startDate
        ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')} ${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
        : '',
      end: endDate
        ? `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')} ${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
        : '',
    }),
    [startDate, endDate]
  );

  if (loading) return <LoadingView text="加载计划..." />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heading, { color: theme.text }]}>
          {editId ? '编辑计划' : '新建计划'}
        </Text>

        <Card>
          <Text style={[styles.label, { color: theme.textSecondary }]}>计划标题 *</Text>
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                  },
                ]}
                placeholder="例如：冲刺项目里程碑"
                placeholderTextColor={theme.muted}
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.title ? (
            <Text style={styles.error}>{errors.title.message}</Text>
          ) : null}

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: spacing.md }]}>
            描述
          </Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[
                  styles.input,
                  {
                    minHeight: 64,
                    borderColor: theme.border,
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                  },
                ]}
                placeholder="可选"
                placeholderTextColor={theme.muted}
                value={value}
                onChangeText={onChange}
                multiline
              />
            )}
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>时间段（支持跨天）</Text>
          <TouchableOpacity
            style={[styles.timeBtn, { borderBottomColor: theme.border }]}
            onPress={() => openDateTimePicker('start')}
          >
            <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>开始</Text>
            <Text style={[styles.timeValue, { color: theme.primary }]}>{dateLabel.start}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeBtn, { borderBottomColor: theme.border }]}
            onPress={() => openDateTimePicker('end')}
          >
            <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>结束</Text>
            <Text style={[styles.timeValue, { color: theme.primary }]}>{dateLabel.end}</Text>
          </TouchableOpacity>
          {endDate.getTime() <= startDate.getTime() ? (
            <Text style={styles.error}>结束时间必须晚于开始时间</Text>
          ) : null}

          {/* 仅 iOS 使用内联选择器；Android 用命令式 date→time，避免 datetime.dismiss 崩溃 */}
          {Platform.OS === 'ios' && picker ? (
            <>
              <DateTimePicker
                value={picker === 'start' ? startDate : endDate}
                mode="datetime"
                display="spinner"
                onChange={onPickerChange}
                locale="zh-CN"
              />
              <PrimaryButton
                title="完成选择"
                variant="ghost"
                onPress={() => setPicker(null)}
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : null}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>预计总工时</Text>
          <View style={styles.row}>
            <Controller
              control={control}
              name="plannedHours"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    styles.num,
                    { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text },
                  ]}
                  keyboardType="number-pad"
                  value={String(value)}
                  onChangeText={onChange}
                />
              )}
            />
            <Text style={[styles.unit, { color: theme.textSecondary }]}>小时</Text>
            <Controller
              control={control}
              name="plannedMins"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    styles.num,
                    { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text },
                  ]}
                  keyboardType="number-pad"
                  value={String(value)}
                  onChangeText={onChange}
                />
              )}
            />
            <Text style={[styles.unit, { color: theme.textSecondary }]}>分钟</Text>
          </View>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            合计 {formatMinutes(totalPlanned)}
          </Text>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>任务列表</Text>
            <TouchableOpacity
              onPress={() =>
                append({
                  description: '',
                  planned_minutes: 25,
                  completed_percent: 0,
                })
              }
            >
              <Text style={[styles.link, { color: theme.primary }]}>+ 添加任务</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.sumBox,
              match ? styles.sumOk : styles.sumBad,
            ]}
          >
            <Text style={styles.sumText}>
              任务合计 {taskSum} 分钟 / 总工时 {totalPlanned} 分钟
              {match ? ' ✓' : ' — 必须相等才能保存'}
            </Text>
          </View>
          {errors.tasks?.message || errors.tasks?.root?.message ? (
            <Text style={styles.error}>
              {errors.tasks?.message || errors.tasks?.root?.message}
            </Text>
          ) : null}

          {fields.map((field, index) => (
            <View
              key={field.id}
              style={[
                styles.taskItem,
                { borderColor: theme.border, backgroundColor: theme.inputBg },
              ]}
            >
              <View style={styles.rowBetween}>
                <Text style={[styles.taskIndex, { color: theme.text }]}>任务 {index + 1}</Text>
                <View style={styles.row}>
                  {index > 0 ? (
                    <TouchableOpacity onPress={() => move(index, index - 1)}>
                      <Text style={[styles.link, { color: theme.primary }]}>上移</Text>
                    </TouchableOpacity>
                  ) : null}
                  {index < fields.length - 1 ? (
                    <TouchableOpacity
                      onPress={() => move(index, index + 1)}
                      style={{ marginLeft: 12 }}
                    >
                      <Text style={[styles.link, { color: theme.primary }]}>下移</Text>
                    </TouchableOpacity>
                  ) : null}
                  {fields.length > 1 ? (
                    <TouchableOpacity
                      onPress={() => remove(index)}
                      style={{ marginLeft: 12 }}
                    >
                      <Text style={[styles.link, { color: theme.danger }]}>删除</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <Controller
                control={control}
                name={`tasks.${index}.description`}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.card,
                        color: theme.text,
                      },
                    ]}
                    placeholder="任务描述"
                    placeholderTextColor={theme.muted}
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
              <View style={[styles.row, { marginTop: spacing.sm }]}>
                <Text style={[styles.unit, { color: theme.textSecondary }]}>预计</Text>
                <Controller
                  control={control}
                  name={`tasks.${index}.planned_minutes`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[
                        styles.input,
                        styles.num,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.card,
                          color: theme.text,
                        },
                      ]}
                      keyboardType="number-pad"
                      value={String(value)}
                      onChangeText={onChange}
                    />
                  )}
                />
                <Text style={[styles.unit, { color: theme.textSecondary }]}>分钟</Text>
              </View>
            </View>
          ))}
        </Card>

        <PrimaryButton
          title={editId ? '保存修改' : '创建计划'}
          onPress={handleSubmit(onSubmit)}
          loading={saving}
          disabled={!match}
          variant="accent"
          style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.75,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderColor: 'rgba(128,128,128,0.35)',
  },
  num: { width: 72, textAlign: 'center' },
  unit: { marginHorizontal: 6, opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  timeLabel: { fontWeight: '600', opacity: 0.7 },
  timeValue: { fontWeight: '600' },
  hint: { marginTop: 8, fontSize: 12, opacity: 0.7 },
  link: { fontWeight: '600', fontSize: 13 },
  sumBox: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  sumOk: { backgroundColor: 'rgba(34,197,94,0.2)' },
  sumBad: { backgroundColor: 'rgba(239,68,68,0.2)' },
  sumText: { fontSize: 12, fontWeight: '600' },
  taskItem: {
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  taskIndex: { fontWeight: '700', marginBottom: 8 },
  error: { color: '#EF4444', fontSize: 12, marginTop: 4 },
});
