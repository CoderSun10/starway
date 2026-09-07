import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

/**
 * Expo Go（SDK 53+）Android 无远程推送，会刷 ERROR。
 * 本地定时通知：正式 APK / development build 可用；Expo Go Android 跳过 schedule。
 */
function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

export function canUseScheduledLocalNotification() {
  if (isExpoGo() && Platform.OS === 'android') return false;
  return true;
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // ignore
}

export async function ensureNotificationPermission() {
  if (!canUseScheduledLocalNotification()) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * 到点本地通知：App 在后台时仍可提醒（依赖系统闹钟通道）
 * 与 JS setInterval 互补：后台 JS 可能被挂起，通知兜底。
 */
export async function scheduleTimerEndNotification(secondsFromNow, title, body) {
  if (!canUseScheduledLocalNotification()) {
    return null;
  }
  try {
    await ensureNotificationPermission();
    if (secondsFromNow < 1) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('pomodoro', {
        name: '番茄钟计时',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400, 200, 600],
        lightColor: '#F0C14D',
        sound: 'default',
        enableVibrate: true,
      });
    }

    const seconds = Math.max(1, Math.floor(secondsFromNow));
    const trigger =
      Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL != null
        ? {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            channelId: Platform.OS === 'android' ? 'pomodoro' : undefined,
          }
        : {
            seconds,
            channelId: Platform.OS === 'android' ? 'pomodoro' : undefined,
          };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: title || '专注时间结束',
        body: body || '请回到凝时记录本次专注内容。',
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'pomodoro' } : {}),
      },
      trigger,
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelNotification(id) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore
  }
}

export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
