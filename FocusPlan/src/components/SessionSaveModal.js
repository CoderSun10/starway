import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { radius, spacing } from '../constants/themes';
import { useTheme } from '../stores/themeStore';
import PrimaryButton from './PrimaryButton';
import { fetchSchedules } from '../services/api';
import { formatMinutes } from '../utils/time';

/**
 * 使用 React Native 内置 Modal，避免 react-native-modal
 * 在 RN 0.81+ 上调用已删除的 BackHandler.removeEventListener 崩溃
 */
export default function SessionSaveModal({
  visible,
  summary,
  onCancel,
  onSave,
  saving,
}) {
  const theme = useTheme();
  const [mode, setMode] = useState('schedule');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scheduleId, setScheduleId] = useState(null);
  /** 可选：本次会话关联到哪个任务（null = 只关联计划） */
  const [taskId, setTaskId] = useState(null);
  const [content, setContent] = useState('');
  const [taskProgress, setTaskProgress] = useState({}); // { taskId: percent }
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMode('schedule');
    setScheduleId(null);
    setTaskId(null);
    setContent('');
    setTaskProgress({});
    setError('');
    setLoading(true);
    fetchSchedules()
      .then((list) => setSchedules(list || []))
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const selectedSchedule = schedules.find((s) => s.id === scheduleId);
  const tasks = selectedSchedule?.tasks || [];

  // 根据返回数据计算每个任务的“当前”完成百分比（优先使用 completed_percent）
  const getCurrentPercent = (t) => {
    if (t.completed_percent != null) return Number(t.completed_percent);
    if (t.planned_minutes > 0) {
      return Math.min(100, Math.max(0, Math.round(((t.focused_minutes || 0) / t.planned_minutes) * 100)));
    }
    return 0;
  };

  // 切换计划时：重置可选任务 + 用当前值初始化各任务完成度
  useEffect(() => {
    setTaskId(null);
    if (!scheduleId || tasks.length === 0) {
      setTaskProgress({});
      return;
    }
    const init = {};
    tasks.forEach((t) => {
      init[t.id] = getCurrentPercent(t);
    });
    setTaskProgress(init);
  }, [scheduleId, tasks.length]);

  const handleSave = () => {
    setError('');
    if (mode === 'schedule') {
      if (!scheduleId) {
        setError('请选择计划');
        return;
      }

      // 构建任务进度更新（用户自定义的各任务完成百分比）
      const updates = Object.entries(taskProgress)
        .filter(([_, pct]) => Number.isFinite(Number(pct)))
        .map(([tid, pct]) => ({
          task_id: Number(tid),
          percent: Math.max(0, Math.min(100, Math.round(Number(pct)))),
        }));

      onSave({
        schedule_id: scheduleId,
        // 可选：关联到具体任务；不选则只挂计划
        task_id: taskId || null,
        content: content.trim() || null,
        task_progress_updates: updates.length > 0 ? updates : undefined,
      });
    } else {
      if (!content.trim()) {
        setError('请填写专注内容');
        return;
      }
      onSave({
        schedule_id: null,
        task_id: null,
        content: content.trim(),
      });
    }
  };

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="slide"
      onRequestClose={() => !saving && onCancel?.()}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.mask}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => !saving && onCancel?.()}
        />
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>记录本次专注</Text>
          {summary ? (
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
              时长 {formatMinutes(summary.durationMinutes)}
              {summary.autoFinished ? ' · 计时结束' : ' · 手动结束'}
            </Text>
          ) : null}

          <View style={[styles.tabs, { backgroundColor: theme.background }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                mode === 'schedule' && { backgroundColor: theme.card },
              ]}
              onPress={() => setMode('schedule')}
            >
              <Text
                style={{
                  color: mode === 'schedule' ? theme.primary : theme.textSecondary,
                  fontWeight: mode === 'schedule' ? '700' : '500',
                }}
              >
                关联计划
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'free' && { backgroundColor: theme.card }]}
              onPress={() => setMode('free')}
            >
              <Text
                style={{
                  color: mode === 'free' ? theme.primary : theme.textSecondary,
                  fontWeight: mode === 'free' ? '700' : '500',
                }}
              >
                自由输入
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 320 }}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'schedule' ? (
              loading ? (
                <ActivityIndicator
                  color={theme.primary}
                  style={{ marginVertical: 20 }}
                />
              ) : schedules.length === 0 ? (
                <Text style={[styles.hint, { color: theme.textSecondary }]}>
                  暂无计划，可切换到「自由输入」
                </Text>
              ) : (
                <>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    选择计划
                  </Text>
                  {schedules.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.option,
                        {
                          borderColor:
                            scheduleId === s.id ? theme.primary : theme.border,
                          backgroundColor:
                            scheduleId === s.id ? theme.primarySoft : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        setScheduleId(s.id);
                      }}
                    >
                      <Text style={[styles.optionTitle, { color: theme.text }]}>
                        {s.title}
                      </Text>
                      <Text
                        style={[styles.optionSub, { color: theme.textSecondary }]}
                      >
                        预计 {formatMinutes(s.planned_minutes)} · 当前进度{' '}
                        {(s.progress_percent ?? Math.round(((s.focused_minutes || 0) / (s.planned_minutes || 1)) * 100))}%
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {/* 与桌面端一致：可选关联到某个任务 */}
                  {tasks.length > 0 ? (
                    <>
                      <Text
                        style={[
                          styles.label,
                          { color: theme.textSecondary, marginTop: spacing.md },
                        ]}
                      >
                        关联任务（可选）
                      </Text>
                      <Text
                        style={[
                          styles.hintSmall,
                          { color: theme.muted, marginBottom: spacing.sm },
                        ]}
                      >
                        可不选，仅把本次专注记在计划下；选中则同时关联该任务
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.option,
                          {
                            borderColor:
                              taskId == null ? theme.primary : theme.border,
                            backgroundColor:
                              taskId == null ? theme.primarySoft : 'transparent',
                          },
                        ]}
                        onPress={() => setTaskId(null)}
                      >
                        <Text style={[styles.optionTitle, { color: theme.text }]}>
                          不关联具体任务
                        </Text>
                      </TouchableOpacity>
                      {tasks.map((tk) => (
                        <TouchableOpacity
                          key={`pick-${tk.id}`}
                          style={[
                            styles.option,
                            {
                              borderColor:
                                taskId === tk.id ? theme.primary : theme.border,
                              backgroundColor:
                                taskId === tk.id
                                  ? theme.primarySoft
                                  : 'transparent',
                            },
                          ]}
                          onPress={() => setTaskId(tk.id)}
                        >
                          <Text style={[styles.optionTitle, { color: theme.text }]}>
                            {tk.description}
                          </Text>
                          <Text
                            style={[styles.optionSub, { color: theme.textSecondary }]}
                          >
                            预计 {tk.planned_minutes} 分钟
                          </Text>
                        </TouchableOpacity>
                      ))}

                      <Text
                        style={[
                          styles.label,
                          { color: theme.textSecondary, marginTop: spacing.md },
                        ]}
                      >
                        各任务完成度（可手动调整）
                      </Text>
                      <Text
                        style={[
                          styles.hintSmall,
                          { color: theme.muted, marginBottom: spacing.sm },
                        ]}
                      >
                        根据本次专注后的主观感受设置每个任务的完成百分比，计划进度
                        = 各任务平均值
                      </Text>

                      {tasks.map((t) => {
                        const current = getCurrentPercent(t);
                        const edited = taskProgress[t.id] ?? current;
                        return (
                          <View key={t.id} style={[styles.option, { borderColor: theme.border }]}>
                            <Text style={[styles.optionTitle, { color: theme.text }]}>
                              {t.description}
                            </Text>
                            <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                              预计 {t.planned_minutes} 分钟 · 当前 {current}%
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>本次完成后</Text>
                              <TextInput
                                style={[
                                  styles.input,
                                  {
                                    width: 70,
                                    paddingVertical: 4,
                                    paddingHorizontal: 8,
                                    fontSize: 15,
                                    borderColor: theme.primary,
                                    backgroundColor: theme.inputBg,
                                    color: theme.text,
                                  },
                                ]}
                                keyboardType="numeric"
                                value={String(edited)}
                                selectTextOnFocus
                                maxLength={3}
                                placeholder="0"
                                placeholderTextColor={theme.muted}
                                onChangeText={(val) => {
                                  if (val === '' || val == null) {
                                    setTaskProgress(prev => ({ ...prev, [t.id]: 0 }));
                                    return;
                                  }
                                  const num = parseInt(val, 10);
                                  if (!isNaN(num)) {
                                    const clamped = Math.max(0, Math.min(100, num));
                                    setTaskProgress(prev => ({ ...prev, [t.id]: clamped }));
                                  }
                                }}
                              />
                              <Text style={{ color: theme.textSecondary }}>%</Text>
                            </View>
                          </View>
                        );
                      })}

                      {/* 实时显示调整后的计划进度（各任务平均），让用户清楚知道保存后计划会变成多少 */}
                      {tasks.length > 0 && (() => {
                        const editedValues = tasks.map(t => {
                          const current = getCurrentPercent(t);
                          return taskProgress[t.id] ?? current;
                        });
                        const newAvg = editedValues.length > 0
                          ? Math.round(editedValues.reduce((a, b) => a + b, 0) / editedValues.length)
                          : 0;
                        return (
                          <Text style={{ color: theme.primary, fontSize: 13, marginTop: 4 }}>
                            本次调整后计划进度将变为约 {newAvg}%（各任务平均）
                          </Text>
                        );
                      })()}
                    </>
                  ) : null}

                  <Text
                    style={[
                      styles.label,
                      { color: theme.textSecondary, marginTop: spacing.md },
                    ]}
                  >
                    备注（可选）
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.inputBg,
                        color: theme.text,
                      },
                    ]}
                    placeholder="补充说明..."
                    placeholderTextColor={theme.muted}
                    value={content}
                    onChangeText={setContent}
                  />
                </>
              )
            ) : (
              <>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  工作内容
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      minHeight: 80,
                      borderColor: theme.border,
                      backgroundColor: theme.inputBg,
                      color: theme.text,
                    },
                  ]}
                  placeholder="例如：复习算法、写周报..."
                  placeholderTextColor={theme.muted}
                  value={content}
                  onChangeText={setContent}
                  multiline
                />
              </>
            )}
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <PrimaryButton
              title="放弃"
              variant="outline"
              onPress={onCancel}
              disabled={saving}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="保存记录"
              variant="accent"
              onPress={handleSave}
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
  },
  title: { fontSize: 18, fontWeight: '700' },
  meta: { marginTop: 4, fontSize: 13 },
  tabs: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
    marginVertical: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionTitle: { fontSize: 15, fontWeight: '600' },
  optionSub: { fontSize: 12, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
  },
  hint: { textAlign: 'center', marginVertical: 16 },
  hintSmall: { fontSize: 12, lineHeight: 18 },
  error: { color: '#EF4444', marginTop: spacing.sm, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
