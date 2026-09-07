import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { spacing, radius } from '../constants/themes';
import { useTheme } from '../stores/themeStore';
import Screen from '../components/Screen';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingView from '../components/LoadingView';
import ProgressBar from '../components/ProgressBar';
import PrimaryButton from '../components/PrimaryButton';
import { fetchSchedules, deleteSchedule } from '../services/api';
import { formatMinutes, formatRange, parseUtc } from '../utils/time';
import { TIMEZONE } from '../stores/settingsStore';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** 当前进行中：start <= now <= end（按绝对时刻比较） */
function isActiveNow(item) {
  const now = Date.now();
  const s = parseUtc(item.start_at);
  const e = parseUtc(item.end_at);
  if (!s || !e) return false;
  return s.valueOf() <= now && e.valueOf() >= now;
}

export default function ScheduleListScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  /** all | active — 默认只看进行中 */
  const [scope, setScope] = useState('active');

  const load = useCallback(async () => {
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      const data = await fetchSchedules(params);
      setList(data || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: '加载失败', text2: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const displayList = useMemo(() => {
    if (scope === 'all' || q.trim()) return list;
    return list.filter(isActiveNow);
  }, [list, scope, q]);

  const onDelete = (item) => {
    Alert.alert('删除计划', `确定删除「${item.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSchedule(item.id);
            Toast.show({ type: 'success', text1: '已删除' });
            load();
          } catch (e) {
            Toast.show({ type: 'error', text1: '删除失败', text2: e.message });
          }
        },
      },
    ]);
  };

  const toggleSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchOpen((v) => {
      if (v) setQ('');
      return !v;
    });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.navigate('ScheduleDetail', { id: item.id })}
      onLongPress={() => onDelete(item)}
    >
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text
            style={[
              styles.badge,
              { color: theme.accent, backgroundColor: theme.accentSoft },
            ]}
          >
            {item.tasks?.length || 0} 任务
          </Text>
        </View>
        <Text style={[styles.range, { color: theme.primary }]}>
          {formatRange(item.start_at, item.end_at, TIMEZONE)}
        </Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          预计 {formatMinutes(item.planned_minutes)} · 实际专注{' '}
          {formatMinutes(item.actual_focused_minutes || item.focused_minutes || 0)}
        </Text>
        <ProgressBar
          current={item.focused_minutes || 0}
          total={item.planned_minutes || 1}
          label="计划进度（任务平均）"
        />
      </Card>
    </TouchableOpacity>
  );

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.text }]}>计划安排</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={toggleSearch}
            style={[
              styles.iconBtn,
              {
                borderColor: theme.border,
                backgroundColor: searchOpen ? theme.primarySoft : theme.card,
              },
            ]}
            hitSlop={8}
          >
            <Text style={{ color: theme.primary, fontSize: 16 }}>⌕</Text>
          </TouchableOpacity>
          <PrimaryButton
            title="+ 新建"
            onPress={() => navigation.navigate('ScheduleForm', {})}
            style={styles.newBtn}
            textStyle={{ fontSize: 14 }}
          />
        </View>
      </View>

      {searchOpen ? (
        <View style={styles.searchRow}>
          <TextInput
            style={[
              styles.search,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="搜索计划标题..."
            placeholderTextColor={theme.muted}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
            returnKeyType="search"
            autoFocus
          />
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={load}
          >
            <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>
              搜索
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.scopeRow}>
        <TouchableOpacity
          style={[
            styles.scopeChip,
            {
              borderColor: scope === 'active' ? theme.primary : theme.border,
              backgroundColor:
                scope === 'active' ? theme.primarySoft : 'transparent',
            },
          ]}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setScope('active');
          }}
        >
          <Text
            style={{
              color: scope === 'active' ? theme.primary : theme.textSecondary,
              fontWeight: '600',
              fontSize: 12,
            }}
          >
            进行中
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.scopeChip,
            {
              borderColor: scope === 'all' ? theme.primary : theme.border,
              backgroundColor: scope === 'all' ? theme.primarySoft : 'transparent',
            },
          ]}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setScope('all');
          }}
        >
          <Text
            style={{
              color: scope === 'all' ? theme.primary : theme.textSecondary,
              fontWeight: '600',
              fontSize: 12,
            }}
          >
            全部
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={
            displayList.length === 0
              ? styles.emptyList
              : [styles.list, { paddingBottom: insets.bottom + 16 }]
          }
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
          ListEmptyComponent={
            <EmptyState
              title={scope === 'active' ? '当前没有进行中的计划' : '还没有计划'}
              subtitle={
                scope === 'active'
                  ? '已结束或尚未开始的计划已隐藏，可点「全部」查看'
                  : '创建一个时间段计划，再在番茄钟中关联任务'
              }
              action={
                <PrimaryButton
                  title="创建计划"
                  onPress={() => navigation.navigate('ScheduleForm', {})}
                  style={{ marginTop: spacing.md }}
                />
              }
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { fontSize: 24, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtn: { paddingVertical: 10, paddingHorizontal: 16, minHeight: 40 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  search: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  scopeRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 8,
    marginBottom: spacing.sm,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  list: { padding: spacing.md, paddingTop: spacing.sm },
  emptyList: { flexGrow: 1 },
  card: { marginBottom: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  badge: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    overflow: 'hidden',
    fontWeight: '600',
  },
  range: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  meta: {
    marginTop: 4,
    marginBottom: spacing.sm,
    fontSize: 12,
  },
});
