import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { spacing, radius, THEME_LIST } from '../constants/themes';
import { useTheme, useThemeStore } from '../stores/themeStore';
import Screen from '../components/Screen';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import { useSettingsStore } from '../stores/settingsStore';
import { useTimerStore } from '../stores/timerStore';
import { healthCheck } from '../services/api';
import { APP_NAME, APP_NAME_FULL, APP_SLOGAN } from '../constants/brand';
import {
  FEEDBACK_MODES,
  VIBRATION_LEVELS,
  RINGTONE_PRESETS,
  previewFeedback,
} from '../utils/feedback';

export default function SettingsScreen() {
  const theme = useTheme();
  const themeId = useThemeStore((s) => s.themeId);
  const setThemeId = useThemeStore((s) => s.setThemeId);
  const apiBaseUrl = useSettingsStore((s) => s.apiBaseUrl);
  const setApiBaseUrl = useSettingsStore((s) => s.setApiBaseUrl);
  const feedbackMode = useSettingsStore((s) => s.feedbackMode);
  const vibrationLevel = useSettingsStore((s) => s.vibrationLevel);
  const ringtoneId = useSettingsStore((s) => s.ringtoneId);
  const setFeedbackMode = useSettingsStore((s) => s.setFeedbackMode);
  const setVibrationLevel = useSettingsStore((s) => s.setVibrationLevel);
  const setRingtoneId = useSettingsStore((s) => s.setRingtoneId);
  const plannedMinutes = useTimerStore((s) => s.plannedMinutes);
  const setPlannedMinutes = useTimerStore((s) => s.setPlannedMinutes);
  const timerStatus = useTimerStore((s) => s.status);
  const [previewing, setPreviewing] = useState(false);

  const [urlInput, setUrlInput] = useState(apiBaseUrl);
  const [testing, setTesting] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  const [durationText, setDurationText] = useState(String(plannedMinutes));

  useEffect(() => {
    setDurationText(String(plannedMinutes));
  }, [plannedMinutes]);

  const onDurationChange = (text) => {
    // 只保留数字
    const cleaned = text.replace(/[^\d]/g, '');
    setDurationText(cleaned);
    if (cleaned === '') return;
    if (timerStatus === 'running' || timerStatus === 'paused') {
      Toast.show({ type: 'info', text1: '请先结束当前专注再改时长' });
      return;
    }
    const n = Math.min(200, Math.max(1, parseInt(cleaned, 10) || 1));
    setPlannedMinutes(n);
  };

  const onDurationBlur = () => {
    if (durationText === '') {
      setDurationText(String(plannedMinutes));
      return;
    }
    const n = Math.min(200, Math.max(1, parseInt(durationText, 10) || 45));
    setDurationText(String(n));
    if (timerStatus !== 'running' && timerStatus !== 'paused') {
      setPlannedMinutes(n);
    }
  };

  const onSaveUrl = () => {
    const url = urlInput.trim().replace(/\/$/, '');
    if (!/^https?:\/\//.test(url)) {
      Toast.show({ type: 'error', text1: '请输入合法的 http(s) 地址' });
      return;
    }
    setApiBaseUrl(url);
    Toast.show({ type: 'success', text1: '已保存' });
  };

  const onTest = async () => {
    setTesting(true);
    try {
      setApiBaseUrl(urlInput.trim().replace(/\/$/, ''));
      const res = await healthCheck();
      Toast.show({
        type: 'success',
        text1: '连接成功',
        text2: res.message || 'API OK',
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: '连接失败', text2: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: spacing.md }}>
      <Text style={[styles.heading, { color: theme.text }]}>设置</Text>

      {/* 1. 主题 */}
      <Card>
        <Text style={[styles.section, { color: theme.text }]}>主题</Text>
        <View style={styles.themeGrid}>
          {THEME_LIST.map((t) => {
            const active = themeId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.themeChip,
                  {
                    borderColor: active ? theme.primary : theme.border,
                    backgroundColor: active ? theme.primarySoft : theme.inputBg,
                  },
                ]}
                onPress={() => setThemeId(t.id)}
              >
                <Text
                  style={[
                    styles.themeChipText,
                    { color: active ? theme.primary : theme.textSecondary },
                  ]}
                >
                  {t.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* 2. 专注时长 — 单行 */}
      <Card style={{ marginTop: spacing.md }}>
        <View style={styles.durationRow}>
          <Text style={[styles.durationLabel, { color: theme.text }]}>专注时长</Text>
          <View style={styles.durationRight}>
            <TextInput
              style={[
                styles.durationInput,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                },
              ]}
              keyboardType="number-pad"
              value={durationText}
              onChangeText={onDurationChange}
              onBlur={onDurationBlur}
              maxLength={3}
              selectTextOnFocus
            />
            <Text style={[styles.durationUnit, { color: theme.textSecondary }]}>分钟</Text>
          </View>
        </View>
      </Card>

      {/* 3. 结束提醒：震动 / 铃声 */}
      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.section, { color: theme.text }]}>结束提醒</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          计时结束时使用震动、铃声或两者；切到后台时还会用系统本地通知兜底
        </Text>

        <Text style={[styles.subLabel, { color: theme.textSecondary }]}>提醒方式</Text>
        <View style={styles.themeGrid}>
          {FEEDBACK_MODES.map((m) => {
            const active = feedbackMode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.themeChip,
                  {
                    borderColor: active ? theme.primary : theme.border,
                    backgroundColor: active ? theme.primarySoft : theme.inputBg,
                  },
                ]}
                onPress={() => setFeedbackMode(m.id)}
              >
                <Text
                  style={[
                    styles.themeChipText,
                    { color: active ? theme.primary : theme.textSecondary },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {feedbackMode === 'both' || feedbackMode === 'vibrate' ? (
          <>
            <Text
              style={[
                styles.subLabel,
                { color: theme.textSecondary, marginTop: spacing.md },
              ]}
            >
              震动强度
            </Text>
            <View style={styles.themeGrid}>
              {VIBRATION_LEVELS.map((v) => {
                const active = vibrationLevel === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.themeChip,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active
                          ? theme.primarySoft
                          : theme.inputBg,
                      },
                    ]}
                    onPress={() => setVibrationLevel(v.id)}
                  >
                    <Text
                      style={[
                        styles.themeChipText,
                        { color: active ? theme.primary : theme.textSecondary },
                      ]}
                    >
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        {feedbackMode === 'both' || feedbackMode === 'sound' ? (
          <>
            <Text
              style={[
                styles.subLabel,
                { color: theme.textSecondary, marginTop: spacing.md },
              ]}
            >
              铃声（在线预设音效）
            </Text>
            <View style={styles.themeGrid}>
              {RINGTONE_PRESETS.map((r) => {
                const active = ringtoneId === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.themeChip,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active
                          ? theme.primarySoft
                          : theme.inputBg,
                      },
                    ]}
                    onPress={() => setRingtoneId(r.id)}
                  >
                    <Text
                      style={[
                        styles.themeChipText,
                        { color: active ? theme.primary : theme.textSecondary },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        {feedbackMode !== 'none' ? (
          <PrimaryButton
            title={previewing ? '试听中…' : '试一下当前效果'}
            variant="ghost"
            loading={previewing}
            disabled={previewing}
            style={{ marginTop: spacing.md }}
            onPress={async () => {
              if (previewing) return;
              setPreviewing(true);
              try {
                const result = await previewFeedback({
                  mode: feedbackMode,
                  vibrationLevel,
                  ringtoneId,
                });
                if (
                  (feedbackMode === 'both' || feedbackMode === 'sound') &&
                  result &&
                  result.soundOk === false
                ) {
                  Toast.show({
                    type: 'error',
                    text1: '铃声播放失败',
                    text2: result.soundError || '请检查设备音量是否静音',
                  });
                }
              } catch (e) {
                Toast.show({
                  type: 'error',
                  text1: '试听失败',
                  text2: e?.message || '请重试',
                });
              } finally {
                setPreviewing(false);
              }
            }}
          />
        ) : null}
      </Card>

      {/* 4. 配置（折叠 API） */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setConfigVisible(true)}
        style={{ marginTop: spacing.md }}
      >
        <Card>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.section, { color: theme.text, marginBottom: 4 }]}>
                配置
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                开发与连接选项
              </Text>
            </View>
            <Text style={{ color: theme.primary, fontSize: 20, fontWeight: '300' }}>›</Text>
          </View>
        </Card>
      </TouchableOpacity>

      {/* 5. 关于 */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setAboutVisible(true)}
        style={{ marginTop: spacing.md }}
      >
        <Card>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.section, { color: theme.text, marginBottom: 4 }]}>
                关于 {APP_NAME}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                版本与说明
              </Text>
            </View>
            <Text style={{ color: theme.primary, fontSize: 20, fontWeight: '300' }}>›</Text>
          </View>
        </Card>
      </TouchableOpacity>

      {/* 配置弹窗 */}
      <Modal
        visible={configVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfigVisible(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setConfigVisible(false)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>配置</Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              API 地址（仅调试用）
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
              autoCapitalize="none"
              autoCorrect={false}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="http://127.0.0.1:3001"
              placeholderTextColor={theme.muted}
            />
            <View style={styles.row}>
              <PrimaryButton
                title="保存"
                onPress={onSaveUrl}
                style={{ flex: 1 }}
                variant="outline"
              />
              <PrimaryButton
                title="测试"
                onPress={onTest}
                loading={testing}
                style={{ flex: 1 }}
                variant="accent"
              />
            </View>
            <PrimaryButton
              title="关闭"
              variant="ghost"
              onPress={() => setConfigVisible(false)}
              style={{ marginTop: spacing.md }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* 关于弹窗 */}
      <Modal
        visible={aboutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAboutVisible(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setAboutVisible(false)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>{APP_NAME_FULL}</Text>
            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>
              {APP_SLOGAN}{'\n\n'}
              版本 1.0.0 · Expo SDK 54{'\n'}
              创建计划 → 番茄钟 → 关联记录 → 统计{'\n'}
              显示时区：北京时间（UTC+8）
            </Text>
            <PrimaryButton title="知道了" onPress={() => setAboutVisible(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  section: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  themeChipText: { fontSize: 13, fontWeight: '600' },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  durationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationInput: {
    width: 72,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  durationUnit: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.md,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
});
