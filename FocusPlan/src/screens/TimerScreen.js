import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  StatusBar as RNStatusBar,
  PanResponder,
  Animated,
  Easing,
  AppState,
} from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { spacing, radius } from '../constants/themes';
import { useTheme } from '../stores/themeStore';
import { useUiStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import SessionSaveModal from '../components/SessionSaveModal';
import { useTimerStore } from '../stores/timerStore';
import { formatCountdown } from '../utils/time';
import { createSession } from '../services/api';
import {
  scheduleTimerEndNotification,
  cancelNotification,
  cancelAllNotifications,
} from '../utils/notifications';
import { playFinishFeedback } from '../utils/feedback';

const MIN_MINUTES = 1;
const MAX_MINUTES = 200;
const ITEM_H = 44;
const RING = Math.min(Dimensions.get('window').width - 56, 300);
const DRAG_STEP = 26;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function clampMin(m) {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(m)));
}

export default function TimerScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const setHideTabBar = useUiStore((s) => s.setHideTabBar);
  const {
    plannedMinutes,
    remainingSeconds,
    status,
    setPlannedMinutes,
    start,
    tick,
    syncFromWallClock,
    finishAndReset,
  } = useTimerStore();

  const [picking, setPicking] = useState(false);
  const [wheelMin, setWheelMin] = useState(plannedMinutes);
  const [notifId, setNotifId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [summary, setSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dimmed, setDimmed] = useState(false);

  const finishingRef = useRef(false);
  const pickIdleRef = useRef(null);
  const focusIdleRef = useRef(null);
  const notifIdRef = useRef(null);
  const wheelMinRef = useRef(plannedMinutes);
  const dragAccRef = useRef(0);
  const momentumRef = useRef(null);
  const dimAnim = useRef(new Animated.Value(0)).current;
  const pickAnim = useRef(new Animated.Value(0)).current;
  const uiAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    notifIdRef.current = notifId;
  }, [notifId]);

  useEffect(() => {
    if (status === 'idle' && !picking) {
      setWheelMin(plannedMinutes);
      wheelMinRef.current = plannedMinutes;
    }
  }, [plannedMinutes, status, picking]);

  // 前台：高频按墙钟刷新
  useEffect(() => {
    if (status !== 'running') return undefined;
    const id = setInterval(() => {
      const left = tick();
      if (left <= 0) doFinish();
    }, 200);
    return () => clearInterval(id);
  }, [status]);

  // 切到后台再回来：用墙钟补算，进度不丢
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const st = useTimerStore.getState().status;
      if (st !== 'running') return;
      const left = syncFromWallClock();
      if (left <= 0) {
        doFinish();
      } else {
        // 重新对齐本地结束通知（部分系统会清掉后台任务）
        const sec = useTimerStore.getState().remainingSeconds;
        cancelNotification(notifIdRef.current).catch(() => {});
        scheduleTimerEndNotification(
          sec,
          '专注时间结束',
          '请回到凝时记录本次专注内容'
        ).then((id) => setNotifId(id));
      }
    });
    return () => sub.remove();
  }, [syncFromWallClock]);

  useEffect(() => {
    if (status === 'running') {
      activateKeepAwakeAsync('pomodoro').catch(() => {});
    } else {
      deactivateKeepAwake('pomodoro');
      enterDimmed(false);
    }
    return () => deactivateKeepAwake('pomodoro');
  }, [status]);

  const enterDimmed = useCallback(
    (on) => {
      if (on) {
        setDimmed(true);
        setHideTabBar(true);
        Animated.timing(dimAnim, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        Animated.timing(uiAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start();
      } else {
        setHideTabBar(false);
        Animated.parallel([
          Animated.timing(dimAnim, {
            toValue: 0,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(uiAnim, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
        ]).start(() => setDimmed(false));
      }
    },
    [dimAnim, uiAnim, setHideTabBar]
  );

  const resetFocusIdle = useCallback(() => {
    if (focusIdleRef.current) clearTimeout(focusIdleRef.current);
    if (status !== 'running') {
      enterDimmed(false);
      return;
    }
    focusIdleRef.current = setTimeout(() => enterDimmed(true), 5000);
  }, [status, enterDimmed]);

  useEffect(() => {
    if (status === 'running') {
      enterDimmed(false);
      setPicking(false);
      resetFocusIdle();
    } else {
      if (focusIdleRef.current) clearTimeout(focusIdleRef.current);
      setHideTabBar(false);
    }
    return () => {
      if (focusIdleRef.current) clearTimeout(focusIdleRef.current);
      setHideTabBar(false);
      if (momentumRef.current) cancelAnimationFrame(momentumRef.current);
    };
  }, [status, resetFocusIdle, enterDimmed, setHideTabBar]);

  const commitPick = useCallback(() => {
    const m = clampMin(wheelMinRef.current || 45);
    setPlannedMinutes(m);
    setWheelMin(m);
    setPicking(false);
    dragAccRef.current = 0;
    if (pickIdleRef.current) {
      clearTimeout(pickIdleRef.current);
      pickIdleRef.current = null;
    }
    Animated.timing(pickAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [setPlannedMinutes, pickAnim]);

  const bumpPickIdle = useCallback(() => {
    if (pickIdleRef.current) clearTimeout(pickIdleRef.current);
    pickIdleRef.current = setTimeout(() => commitPick(), 2000);
  }, [commitPick]);

  const openPicker = () => {
    if (status !== 'idle') return;
    setPicking(true);
    setWheelMin(plannedMinutes);
    wheelMinRef.current = plannedMinutes;
    dragAccRef.current = 0;
    Animated.timing(pickAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    bumpPickIdle();
  };

  const applyDeltaMinutes = (delta) => {
    if (!delta) return;
    const next = clampMin((wheelMinRef.current || 45) + delta);
    wheelMinRef.current = next;
    setWheelMin(next);
  };

  /** 松手后惯性滑动：速度衰减，产生“拖尾” */
  const runMomentum = (velocityY) => {
    // velocityY: 像素/ms，向上为负 → 分钟增加
    let v = -velocityY * 16; // 归一成“每帧像素”大概量
    if (Math.abs(v) < 0.8) {
      bumpPickIdle();
      return;
    }
    let acc = 0;
    const friction = 0.94;
    const tickMom = () => {
      v *= friction;
      acc += v;
      const steps = Math.trunc(acc / DRAG_STEP);
      if (steps !== 0) {
        acc -= steps * DRAG_STEP;
        applyDeltaMinutes(steps);
      }
      if (Math.abs(v) > 0.35) {
        momentumRef.current = requestAnimationFrame(tickMom);
      } else {
        momentumRef.current = null;
        bumpPickIdle();
      }
    };
    if (momentumRef.current) cancelAnimationFrame(momentumRef.current);
    momentumRef.current = requestAnimationFrame(tickMom);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragAccRef.current = 0;
          if (pickIdleRef.current) clearTimeout(pickIdleRef.current);
          if (momentumRef.current) {
            cancelAnimationFrame(momentumRef.current);
            momentumRef.current = null;
          }
        },
        onPanResponderMove: (_, gesture) => {
          const steps = Math.trunc(-gesture.dy / DRAG_STEP);
          const applied = Math.trunc(dragAccRef.current);
          const delta = steps - applied;
          if (delta !== 0) {
            dragAccRef.current = steps;
            applyDeltaMinutes(delta);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          dragAccRef.current = 0;
          // vy 单位约 px/ms
          runMomentum(gesture.vy || 0);
        },
        onPanResponderTerminate: () => {
          dragAccRef.current = 0;
          bumpPickIdle();
        },
      }),
    [bumpPickIdle]
  );

  const onUserActivity = () => {
    if (status === 'running') {
      if (dimmed) enterDimmed(false);
      resetFocusIdle();
    }
  };

  const doFinish = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    enterDimmed(false);
    try {
      cancelNotification(notifIdRef.current).catch(() => {});
      cancelAllNotifications().catch(() => {});
      setNotifId(null);
      playFinishFeedback(
        useSettingsStore.getState().getFeedbackOptions()
      ).catch(() => {});
      const s = finishAndReset();
      if (s) {
        setSummary(s);
        setModalVisible(true);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: '结束失败', text2: e.message });
      try {
        finishAndReset();
      } catch {
        /* ignore */
      }
    } finally {
      finishingRef.current = false;
    }
  };

  const onPrimaryPress = async () => {
    if (picking) commitPick();
    if (status === 'idle') {
      start();
      const seconds = useTimerStore.getState().remainingSeconds;
      try {
        const id = await scheduleTimerEndNotification(
          seconds,
          '专注时间结束',
          '请回到凝时记录本次专注内容'
        );
        setNotifId(id);
      } catch {
        /* ignore */
      }
      return;
    }
    await doFinish();
  };

  const onSaveSession = async (extra) => {
    if (!summary) return;
    setSaving(true);
    try {
      await createSession({
        ...extra,
        started_at: summary.startedAtIso,
        ended_at: summary.endedAtIso,
        duration_minutes: summary.durationMinutes,
        planned_minutes: summary.plannedMinutes,
        status: 'completed',
      });
      Toast.show({ type: 'success', text1: '专注记录已保存' });
      setModalVisible(false);
      setSummary(null);
    } catch (e) {
      Toast.show({ type: 'error', text1: '保存失败', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  const padTop = Math.max(insets.top, 12) + 8;
  const isRunning = status === 'running';
  const displayMin = picking ? wheelMin : plannedMinutes;

  const dimOpacity = dimAnim;
  const normalOpacity = dimAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={[styles.root, { paddingTop: padTop }]}>
      {/* 正常计时 UI（淡出） */}
      <Animated.View
        pointerEvents={dimmed ? 'none' : 'auto'}
        style={[styles.fill, { opacity: normalOpacity }]}
      >
        <View style={styles.center}>
          <View
            style={[
              styles.ring,
              {
                width: RING,
                height: RING,
                borderRadius: RING / 2,
                borderColor: isRunning ? theme.accent : theme.primary,
                backgroundColor:
                  theme.id === 'aurum'
                    ? 'rgba(20,17,14,0.55)'
                    : theme.id === 'dark' || theme.id === 'mist'
                      ? 'rgba(0,0,0,0.25)'
                      : theme.card,
              },
            ]}
          >
            {status === 'idle' && picking ? (
              <View style={styles.wheelBox} {...panResponder.panHandlers}>
                {[-2, -1, 0, 1, 2].map((offset) => {
                  const item = clampMin(wheelMin + offset);
                  const active = offset === 0;
                  const dist = Math.abs(offset);
                  const outOfRange =
                    (offset < 0 && wheelMin + offset < MIN_MINUTES) ||
                    (offset > 0 && wheelMin + offset > MAX_MINUTES);
                  if (outOfRange) {
                    return <View key={`pad-${offset}`} style={styles.wheelItem} />;
                  }
                  return (
                    <View key={`${item}-${offset}`} style={styles.wheelItem}>
                      <Text
                        style={[
                          styles.wheelText,
                          {
                            color: theme.text,
                            fontSize: active ? 34 : dist === 1 ? 22 : 16,
                            opacity: active ? 1 : dist === 1 ? 0.42 : 0.2,
                            fontWeight: active ? '700' : '400',
                          },
                        ]}
                      >
                        {pad2(item)}:00
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : status === 'idle' ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openPicker}
                style={styles.bigTap}
              >
                <Text style={[styles.bigTime, { color: theme.text }]}>
                  {pad2(displayMin)}:00
                </Text>
              </TouchableOpacity>
            ) : (
              <Pressable onPress={onUserActivity} style={styles.bigTap}>
                <Text style={[styles.bigTime, { color: theme.text, fontSize: 48 }]}>
                  {formatCountdown(remainingSeconds)}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <Animated.View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              opacity: uiAnim,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              onUserActivity();
              onPrimaryPress();
            }}
            style={[
              styles.mainBtn,
              { backgroundColor: status === 'idle' ? theme.accent : theme.primary },
            ]}
          >
            <Text
              style={[
                styles.mainBtnText,
                {
                  color:
                    theme.id === 'light'
                      ? '#fff'
                      : theme.id === 'dark'
                        ? '#0B1220'
                        : '#050403',
                },
              ]}
            >
              {status === 'idle' ? '开始专注' : '正在专注'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* 黑屏层（淡入），盖住底栏 */}
      <Animated.View
        pointerEvents={dimmed ? 'auto' : 'none'}
        style={[
          styles.blackout,
          {
            opacity: dimOpacity,
          },
        ]}
      >
        <Pressable style={styles.blackoutInner} onPress={onUserActivity}>
          <RNStatusBar barStyle="light-content" backgroundColor="#000" />
          <Text style={styles.blackoutTime}>
            {formatCountdown(remainingSeconds)}
          </Text>
        </Pressable>
      </Animated.View>

      <SessionSaveModal
        visible={modalVisible}
        summary={summary}
        saving={saving}
        onCancel={() => {
          setModalVisible(false);
          setSummary(null);
        }}
        onSave={onSaveSession}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  ring: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bigTap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
    minHeight: 100,
  },
  bigTime: {
    fontSize: 56,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  wheelBox: {
    width: RING - 16,
    height: ITEM_H * 5,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItem: {
    height: ITEM_H,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  mainBtn: {
    width: '100%',
    maxWidth: 320,
    height: 54,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBtnText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
  },
  blackout: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 100,
  },
  blackoutInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blackoutTime: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: 3,
  },
});
