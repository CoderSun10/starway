import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import duration from 'dayjs/plugin/duration';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(duration);
dayjs.extend(customParseFormat);

/**
 * 北京时间 = 固定 UTC+8（无夏令时）
 * React Native 上 dayjs.tz('Asia/Shanghai') 常因缺少 ICU 时区数据失效，
 * 导致显示成 UTC（比北京时间少 8 小时）。统一用 utcOffset(8) 最稳。
 */
export const SHANGHAI_TZ = 'Asia/Shanghai';
export const SHANGHAI_OFFSET_MINUTES = 8 * 60;

/** 解析后端时间为「绝对时刻」的 dayjs（UTC） */
export function parseUtc(value) {
  if (value == null || value === '') return null;

  if (dayjs.isDayjs(value)) {
    return value.isUTC() ? value : dayjs.utc(value.toDate());
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return dayjs.utc(value.toISOString());
  }

  if (typeof value === 'string') {
    const s = value.trim();
    // MySQL dateStrings：无时区后缀 → 约定为 UTC 墙钟
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
      return dayjs.utc(s, s.length === 16 ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD HH:mm:ss');
    }
    // ISO：2026-07-18T08:32:00.000Z 或带偏移
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      return dayjs.utc(s);
    }
    // 2026-07-18T08:32:00 无 Z → 按 UTC
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
      return dayjs.utc(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
    }
    const d = dayjs.utc(s);
    return d.isValid() ? d : null;
  }

  return null;
}

/** UTC 存储 → 北京时间 dayjs（用于 format） */
export function toDisplay(value, _mode = 'Asia/Shanghai') {
  const utc = parseUtc(value);
  if (!utc || !utc.isValid()) return null;
  return utc.utcOffset(SHANGHAI_OFFSET_MINUTES);
}

/** 当前时刻的 UTC ISO（写入数据库） */
export function nowUtcIso() {
  return new Date().toISOString();
}

/** 当前北京时间 dayjs */
export function nowInMode(_mode = 'Asia/Shanghai') {
  return dayjs.utc().utcOffset(SHANGHAI_OFFSET_MINUTES);
}

/** 今天 YYYY-MM-DD（北京时间） */
export function todayStr(_mode = 'Asia/Shanghai') {
  return nowInMode().format('YYYY-MM-DD');
}

/**
 * DatePicker 的 Date → UTC ISO
 * Date 本身是绝对时刻，直接 toISOString 即可（设备在中国时即用户所选墙钟）
 */
export function toUtcIso(dateLike, _mode = 'Asia/Shanghai') {
  if (dateLike instanceof Date) {
    if (Number.isNaN(dateLike.getTime())) return nowUtcIso();
    return dateLike.toISOString();
  }
  if (typeof dateLike === 'string') {
    const d = new Date(dateLike);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (dayjs.isDayjs(dateLike)) {
    return dateLike.toDate().toISOString();
  }
  return nowUtcIso();
}

/** 某日 00:00 ~ 次日 00:00 的 UTC ISO（按北京时间日历日） */
export function dayBoundsUtc(dateStr, _mode = 'Asia/Shanghai') {
  // 北京 00:00 = UTC 前一天 16:00
  const start = dayjs.utc(`${dateStr} 00:00:00`, 'YYYY-MM-DD HH:mm:ss').subtract(8, 'hour');
  const end = start.add(1, 'day');
  return {
    dayStartUtc: start.toISOString(),
    dayEndUtc: end.toISOString(),
  };
}

export function formatMinutes(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h <= 0) return `${min} 分钟`;
  if (min === 0) return `${h} 小时`;
  return `${h} 小时 ${min} 分钟`;
}

export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatRange(startUtc, endUtc, mode = 'Asia/Shanghai') {
  const s = toDisplay(startUtc, mode);
  const e = toDisplay(endUtc, mode);
  if (!s || !e) return '-';
  const sameDay = s.format('YYYY-MM-DD') === e.format('YYYY-MM-DD');
  if (sameDay) {
    return `${s.format('MM-DD HH:mm')} ~ ${e.format('HH:mm')}`;
  }
  return `${s.format('MM-DD HH:mm')} ~ ${e.format('MM-DD HH:mm')}（跨天）`;
}

export function formatDateTime(utcValue, mode = 'Asia/Shanghai', fmt = 'YYYY-MM-DD HH:mm') {
  const d = toDisplay(utcValue, mode);
  return d ? d.format(fmt) : '-';
}

export function getActiveTimezone(_mode = 'Asia/Shanghai') {
  return SHANGHAI_TZ;
}

export { dayjs };
