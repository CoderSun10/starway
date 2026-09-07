import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import Toast from 'react-native-toast-message';
import { spacing, radius } from '../constants/themes';
import { useTheme } from '../stores/themeStore';
import Screen from '../components/Screen';
import Card from '../components/Card';
import LoadingView from '../components/LoadingView';
import EmptyState from '../components/EmptyState';
import {
  fetchOverview,
  fetchDailyStats,
  fetchBySchedule,
  fetchSessions,
} from '../services/api';
import { formatMinutes, formatDateTime, todayStr } from '../utils/time';
import { TIMEZONE } from '../stores/settingsStore';

const SCREEN_W = Dimensions.get('window').width;
const Y_AXIS_W = 40;
const VIEWPORT_W = SCREEN_W - spacing.md * 2 - spacing.md * 2 - Y_AXIS_W;
const SESSION_TOP_N = 5;
/** 饼图最多直接展示的计划数，其余合并为「其他」 */
const PIE_TOP_N = 5;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** 固定纵轴 + 横向滚动图（末尾留白，最后一天完整显示） */
function ScrollableChart({
  type = 'bar',
  labels,
  values,
  theme,
  chartConfig,
  days,
}) {
  const maxVal = Math.max(1, ...values);
  // 刻度：0, 25%, 50%, 75%, max
  const ticks = [maxVal, Math.round(maxVal * 0.75), Math.round(maxVal * 0.5), Math.round(maxVal * 0.25), 0];
  const pointW = days === 7 ? 56 : 44;
  // 额外尾部 padding，避免最后一个点/柱被裁切
  const chartW = Math.max(VIEWPORT_W, labels.length * pointW + 56);
  const chartH = 200;
  const safeValues = values.map((v) => (v === 0 ? 0.01 : v));

  return (
    <View style={{ flexDirection: 'row', height: chartH + 8 }}>
      {/* 固定 Y 轴 */}
      <View style={{ width: Y_AXIS_W, height: chartH, justifyContent: 'space-between', paddingBottom: 28, paddingTop: 8 }}>
        {ticks.map((t, i) => (
          <Text
            key={`${t}-${i}`}
            style={{
              fontSize: 10,
              color: theme.textSecondary,
              textAlign: 'right',
              paddingRight: 4,
            }}
            numberOfLines={1}
          >
            {t}
          </Text>
        ))}
      </View>

      {/* 仅横向滚动数据区 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        nestedScrollEnabled
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingRight: 24 }}
      >
        {type === 'bar' ? (
          <BarChart
            data={{
              labels,
              datasets: [{ data: safeValues }],
            }}
            width={chartW}
            height={chartH}
            chartConfig={chartConfig}
            fromZero
            showValuesOnTopOfBars={days === 7}
            withHorizontalLabels={false}
            withInnerLines
            style={{ marginLeft: -8, borderRadius: 8 }}
            yAxisLabel=""
            yAxisSuffix=""
          />
        ) : (
          <LineChart
            data={{
              labels,
              datasets: [
                {
                  data: values.map((v) => (v === 0 ? 0 : v)),
                  color: (opacity = 1) => chartConfig.color(opacity),
                  strokeWidth: 2,
                },
              ],
            }}
            width={chartW}
            height={chartH}
            chartConfig={chartConfig}
            bezier
            fromZero
            withHorizontalLabels={false}
            withInnerLines
            style={{ marginLeft: -8, borderRadius: 8 }}
            yAxisLabel=""
            yAxisSuffix=""
          />
        )}
      </ScrollView>
    </View>
  );
}

export default function StatsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [daily, setDaily] = useState([]);
  const [bySchedule, setBySchedule] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);

  const chartConfig = {
    backgroundGradientFrom: 'transparent',
    backgroundGradientTo: 'transparent',
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    decimalPlaces: 0,
    color: (opacity = 1) => {
      const hex = String(theme.primary).replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${opacity})`;
      }
      return theme.primary;
    },
    labelColor: () => theme.textSecondary,
    propsForDots: { r: '4', strokeWidth: '2', stroke: theme.primary },
    propsForBackgroundLines: { stroke: theme.border },
    fillShadowGradient: theme.primary,
    fillShadowGradientOpacity: 0.22,
    barPercentage: 0.55,
    propsForLabels: {
      fontSize: 10,
    },
  };

  const pieColors = [
    theme.chartBlue,
    theme.chartOrange,
    theme.chartGreen,
    theme.chartPurple,
    theme.chartPink,
    theme.muted,
  ];

  const load = useCallback(async () => {
    const today = todayStr(TIMEZONE);
    try {
      const [ov, d, bs, se] = await Promise.all([
        fetchOverview({ today }),
        fetchDailyStats({ days, today }),
        // 饼图与「近 N 天」同步，避免历史计划无限堆叠
        fetchBySchedule({ days, today }),
        fetchSessions({ limit: 30 }),
      ]);
      setOverview(ov);
      setDaily(d || []);
      setBySchedule(bs || []);
      setSessions(se || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: '统计加载失败', text2: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading && !overview) return <LoadingView text="加载统计..." />;

  const labels = daily.map((d) => d.day.slice(5));
  const values = daily.map((d) => d.total_minutes);
  const hasChartData = values.some((v) => v > 0);

  // Top N + 「其他」：时间长了也不会挤满饼图
  const pieData = (() => {
    const list = (bySchedule || []).filter((x) => Number(x.total_minutes) > 0);
    if (!list.length) return [];
    const top = list.slice(0, PIE_TOP_N);
    const rest = list.slice(PIE_TOP_N);
    const otherMinutes = rest.reduce(
      (s, x) => s + Number(x.total_minutes || 0),
      0
    );
    const rows = top.map((item, i) => ({
      name: (item.schedule_title || '计划').slice(0, 8),
      minutes: item.total_minutes,
      population: item.total_minutes,
      color: pieColors[i % pieColors.length],
      legendFontColor: theme.textSecondary,
      legendFontSize: 12,
    }));
    if (otherMinutes > 0) {
      rows.push({
        name: `其他(${rest.length})`,
        minutes: otherMinutes,
        population: otherMinutes,
        color: pieColors[pieColors.length - 1],
        legendFontColor: theme.textSecondary,
        legendFontSize: 12,
      });
    }
    return rows;
  })();

  const weekDiff =
    overview && overview.last_week_minutes > 0
      ? Math.round(
          ((overview.week_minutes - overview.last_week_minutes) /
            overview.last_week_minutes) *
            100
        )
      : null;

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: insets.bottom + 24,
        }}
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
        <Text style={[styles.heading, { color: theme.text }]}>专注统计</Text>

        <View style={[styles.kpiRow, { marginTop: spacing.md }]}>
          <Card style={styles.kpi}>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>今日专注</Text>
            <Text style={[styles.kpiValue, { color: theme.primary }]}>
              {formatMinutes(overview?.today_minutes || 0)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.muted }]}>
              {overview?.today_pomodoros || 0} 个番茄
            </Text>
          </Card>
          <Card style={styles.kpi}>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>本周</Text>
            <Text style={[styles.kpiValue, { color: theme.primary }]}>
              {formatMinutes(overview?.week_minutes || 0)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.muted }]}>
              {weekDiff == null
                ? `上周 ${formatMinutes(overview?.last_week_minutes || 0)}`
                : `较上周 ${weekDiff >= 0 ? '+' : ''}${weekDiff}%`}
            </Text>
          </Card>
        </View>

        <Card style={{ marginTop: spacing.sm }}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>本月专注</Text>
              <Text style={[styles.kpiValue, { color: theme.primary, fontSize: 22 }]}>
                {formatMinutes(overview?.month_minutes || 0)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>昨日</Text>
              <Text style={[styles.kpiSub, { color: theme.muted }]}>
                {formatMinutes(overview?.yesterday_minutes || 0)}
              </Text>
              <Text style={[styles.kpiSub, { color: theme.muted }]}>
                本月 {overview?.month_pomodoros || 0} 番茄
              </Text>
            </View>
          </View>
        </Card>

        <View
          style={[
            styles.seg,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {[7, 30].map((d) => (
            <TouchableOpacity
              key={d}
              style={[
                styles.segItem,
                days === d && { backgroundColor: theme.primarySoft },
              ]}
              onPress={() => setDays(d)}
            >
              <Text
                style={[
                  styles.segText,
                  { color: days === d ? theme.primary : theme.textSecondary },
                ]}
              >
                近 {d} 天
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card style={{ marginTop: spacing.sm }}>
          <Text style={[styles.chartTitle, { color: theme.text }]}>每日专注时长（分钟）</Text>
          {hasChartData ? (
            <ScrollableChart
              type="bar"
              labels={labels}
              values={values}
              theme={theme}
              chartConfig={chartConfig}
              days={days}
            />
          ) : (
            <EmptyState title="暂无柱状图数据" subtitle="完成几次番茄钟后再来看看" />
          )}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.chartTitle, { color: theme.text }]}>专注时长趋势</Text>
          {hasChartData ? (
            <ScrollableChart
              type="line"
              labels={labels}
              values={values}
              theme={theme}
              chartConfig={chartConfig}
              days={days}
            />
          ) : (
            <EmptyState title="暂无趋势数据" />
          )}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.chartTitle, { color: theme.text }]}>
            按计划时长分布（近 {days} 天）
          </Text>
          <Text style={[styles.pieHint, { color: theme.muted }]}>
            仅展示近期 Top {PIE_TOP_N} 计划，其余合并为「其他」
          </Text>
          {pieData.length > 0 ? (
            <PieChart
              data={pieData}
              width={VIEWPORT_W + Y_AXIS_W}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="12"
              absolute
            />
          ) : (
            <EmptyState
              title="暂无关联计划的会话"
              subtitle="结束番茄钟时选择关联计划即可生成饼图"
            />
          )}
        </Card>

        <View
          style={[
            styles.rowBetween,
            { marginTop: spacing.lg, marginBottom: spacing.sm },
          ]}
        >
          <Text style={[styles.chartTitle, { color: theme.text, marginBottom: 0 }]}>
            历史会话
          </Text>
          {sessions.length > SESSION_TOP_N ? (
            <TouchableOpacity
              onPress={() => {
                LayoutAnimation.configureNext(
                  LayoutAnimation.Presets.easeInEaseOut
                );
                setSessionsExpanded((v) => !v);
              }}
            >
              <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>
                {sessionsExpanded
                  ? '收起'
                  : `展开全部 ${sessions.length} 条`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {sessions.length === 0 ? (
          <EmptyState title="还没有专注记录" />
        ) : (
          (sessionsExpanded
            ? sessions
            : sessions.slice(0, SESSION_TOP_N)
          ).map((s) => (
            <Card key={s.id} style={styles.sessionCard}>
              <View style={styles.rowBetween}>
                <Text
                  style={[styles.sessionTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {s.schedule_title || s.content || '自由专注'}
                </Text>
                <Text style={[styles.sessionMin, { color: theme.accent }]}>
                  {formatMinutes(s.duration_minutes)}
                </Text>
              </View>
              {s.task_description ? (
                <Text style={[styles.sessionTask, { color: theme.textSecondary }]}>
                  任务：{s.task_description}
                </Text>
              ) : null}
              <Text style={[styles.sessionTime, { color: theme.muted }]}>
                {formatDateTime(s.started_at, TIMEZONE)} ~{' '}
                {formatDateTime(s.ended_at, TIMEZONE, 'HH:mm')}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  sub: { marginTop: 4, marginBottom: spacing.md, fontSize: 13 },
  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  kpi: { flex: 1 },
  kpiLabel: { fontSize: 12, fontWeight: '600' },
  kpiValue: { marginTop: 6, fontSize: 18, fontWeight: '800' },
  kpiSub: { marginTop: 4, fontSize: 12 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seg: {
    flexDirection: 'row',
    marginTop: spacing.md,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
  },
  segItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segText: { fontWeight: '600' },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  pieHint: {
    fontSize: 11,
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  chart: { borderRadius: radius.md, marginLeft: -8 },
  sessionCard: { marginTop: spacing.sm },
  sessionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  sessionMin: { fontWeight: '700', fontSize: 13 },
  sessionTask: { marginTop: 4, fontSize: 13 },
  sessionTime: { marginTop: 4, fontSize: 12 },
});
