import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export const SHANGHAI_OFFSET_MINUTES = 8 * 60;

export function parseUtc(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return dayjs.utc(value.toISOString());
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
      return dayjs.utc(s, s.length === 16 ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD HH:mm:ss');
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return dayjs.utc(s);
    const d = dayjs.utc(s);
    return d.isValid() ? d : null;
  }
  return null;
}

export function toDisplay(value) {
  const utcVal = parseUtc(value);
  if (!utcVal?.isValid()) return null;
  return utcVal.utcOffset(SHANGHAI_OFFSET_MINUTES);
}

export function nowUtcIso() {
  return new Date().toISOString();
}

export function nowInShanghai() {
  return dayjs.utc().utcOffset(SHANGHAI_OFFSET_MINUTES);
}

export function todayStr() {
  return nowInShanghai().format('YYYY-MM-DD');
}

/** datetime-local 值 → UTC ISO（按北京墙钟理解） */
export function localInputToUtcIso(localStr) {
  if (!localStr) return nowUtcIso();
  // localStr: YYYY-MM-DDTHH:mm
  const m = dayjs(localStr);
  if (!m.isValid()) return nowUtcIso();
  // 把用户输入当作北京时间墙钟
  return dayjs
    .utc(m.format('YYYY-MM-DD HH:mm:ss'), 'YYYY-MM-DD HH:mm:ss')
    .subtract(8, 'hour')
    .toISOString();
}

/** UTC → datetime-local 字符串（北京时间） */
export function utcToLocalInput(utcValue) {
  const d = toDisplay(utcValue);
  return d ? d.format('YYYY-MM-DDTHH:mm') : '';
}

/** 统一分钟制展示：100 分钟 */
export function formatMinutes(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  return `${m} 分钟`;
}

/** 悬停说明：1 小时 40 分钟 */
export function formatMinutesVerbose(totalMinutes) {
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

export function formatRange(startUtc, endUtc) {
  const s = toDisplay(startUtc);
  const e = toDisplay(endUtc);
  if (!s || !e) return '-';
  const sameDay = s.format('YYYY-MM-DD') === e.format('YYYY-MM-DD');
  if (sameDay) return `${s.format('MM-DD HH:mm')} ~ ${e.format('HH:mm')}`;
  return `${s.format('MM-DD HH:mm')} ~ ${e.format('MM-DD HH:mm')}（跨天）`;
}

export function formatDateTime(utcValue, fmt = 'YYYY-MM-DD HH:mm') {
  const d = toDisplay(utcValue);
  return d ? d.format(fmt) : '-';
}

export function formatMinutesCompact(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (m <= 0) return '';
  return `${m}′`;
}

/** keep in sync with timeLogic.visibleMonthRange */
export function visibleMonthRange(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const from = new Date(first);
  from.setUTCDate(1 - mondayOffset);
  const weeks = Math.ceil((mondayOffset + last.getUTCDate()) / 7);
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + weeks * 7 - 1);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export function inclusiveDayCount(start, end) {
  const [y1, m1, d1] = String(start).split('-').map(Number);
  const [y2, m2, d2] = String(end).split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1;
}

export function eachUtcDate(from, to) {
  const [y1, m1, d1] = String(from).split('-').map(Number);
  const n = inclusiveDayCount(from, to);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const dt = new Date(Date.UTC(y1, m1 - 1, d1));
    dt.setUTCDate(dt.getUTCDate() + i);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

export { dayjs };
