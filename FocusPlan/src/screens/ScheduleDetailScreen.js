import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { spacing, radius } from '../constants/themes';
import { useTheme } from '../stores/themeStore';
import Card from '../components/Card';
import LoadingView from '../components/LoadingView';
import ProgressBar from '../components/ProgressBar';
import PrimaryButton from '../components/PrimaryButton';
import { fetchSchedule, deleteSchedule, fetchScheduleStats } from '../services/api';
import { TIMEZONE } from '../stores/settingsStore';
import { formatMinutes, formatRange, formatDateTime } from '../utils/time';

export default function ScheduleDetailScreen({ navigation, route }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const id = route.params?.id;
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, st] = await Promise.all([
        fetchSchedule(id),
        fetchScheduleStats(id),
      ]);
      setData(detail);
      setStats(st);
    } catch (e) {
      Toast.show({ type: 'error', text1: '加载失败', text2: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading && !data) return <LoadingView />;
  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ textAlign: 'center', marginTop: 40, color: theme.textSecondary }}>
          计划不存在
        </Text>
      </View>
    );
  }

  const focused = stats?.focused_minutes ?? data.focused_minutes ?? 0;
  const planned = data.planned_minutes || 1;
  const planProgressPct = stats?.progress_percent ?? data?.progress_percent ?? Math.round((focused / (planned || 1)) * 100);

  // 与 Tab 页 Screen 顶部留白节奏一致（状态栏下再 +10 的感觉，由导航栏承担状态栏）
  const contentPadTop = 12;

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor:
            theme.id === 'aurum' ? 'transparent' : theme.background,
        },
      ]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: contentPadTop,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={theme.primary}
        />
      }
    >
      <Text style={[styles.title, { color: theme.text }]}>{data.title}</Text>
      {data.description ? (
        <Text style={[styles.desc, { color: theme.textSecondary }]}>{data.description}</Text>
      ) : null}

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>时间段</Text>
        <Text style={[styles.value, { color: theme.text }]}>
          {formatRange(data.start_at, data.end_at, TIMEZONE)}
        </Text>
        <Text style={[styles.label, { color: theme.textSecondary, marginTop: spacing.md }]}>
          计划进度（任务平均完成度）
        </Text>
        <Text style={[styles.value, { color: theme.text }]}>
          {planProgressPct}%（实际专注 {formatMinutes(stats?.actual_focused_minutes ?? data.actual_focused_minutes ?? focused ?? 0)}）
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <ProgressBar current={focused} total={planned} label="计划进度（任务平均）" />
        </View>
        <Text style={[styles.meta, { color: theme.muted }]}>
          番茄会话 {stats?.session_count ?? data.session_count ?? 0} 次
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.section, { color: theme.text }]}>任务列表与进度</Text>
        {(stats?.tasks || data.tasks || []).map((t, idx) => (
          <View
            key={t.id || idx}
            style={[styles.task, { borderBottomColor: theme.border }]}
          >
            <View style={styles.rowBetween}>
              <Text style={[styles.taskTitle, { color: theme.text }]}>{t.description}</Text>
              <Text
                style={[
                  styles.taskMin,
                  { color: theme.accent, backgroundColor: theme.accentSoft },
                ]}
              >
                {t.planned_minutes} 分
              </Text>
            </View>
            <ProgressBar
              current={t.focused_minutes || 0}
              total={t.planned_minutes || 1}
              label={`进度 ${Math.round(((t.focused_minutes || 0) / (t.planned_minutes || 1)) * 100)}%`}
            />
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <PrimaryButton
          title="编辑"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('ScheduleForm', { id })}
        />
        <PrimaryButton
          title="开始专注"
          variant="accent"
          style={{ flex: 1 }}
          onPress={() => navigation.getParent()?.navigate('TimerTab')}
        />
      </View>
      <PrimaryButton
        title="删除计划"
        variant="danger"
        style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}
        onPress={() => {
          Alert.alert('删除计划', '确定删除吗？关联会话的计划引用会清空。', [
            { text: '取消', style: 'cancel' },
            {
              text: '删除',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteSchedule(id);
                  Toast.show({ type: 'success', text1: '已删除' });
                  navigation.goBack();
                } catch (e) {
                  Toast.show({ type: 'error', text1: e.message });
                }
              },
            },
          ]);
        }}
      />
      <Text style={[styles.footerHint, { color: theme.muted }]}>
        创建于 {formatDateTime(data.created_at, TIMEZONE)}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md },
  title: { fontSize: 24, fontWeight: '800' },
  desc: { marginTop: 6, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600' },
  value: { marginTop: 4, fontSize: 15, fontWeight: '600' },
  meta: { marginTop: spacing.sm, fontSize: 12 },
  section: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  task: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  taskMin: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  footerHint: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: spacing.lg,
  },
});
