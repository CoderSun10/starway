/**
 * 后端纯函数：跨天 / 时区 / 时长计算（无 DB 依赖，便于单元测试）
 * 约定：库内 DATETIME 为 UTC 墙钟；业务日历日为北京时间 UTC+8
 */

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** ISO / Date / 'YYYY-MM-DD HH:mm:ss' → Date */
function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return new Date(value);
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) && !s.includes('T')) {
    // MySQL UTC 字符串
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  return new Date(s);
}

/** 两时刻间隔（分钟），跨天按绝对时间差，与是否跨日历日无关 */
function durationMinutes(start, end) {
  const a = toDate(start).getTime();
  const b = toDate(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 60000);
}

/** UTC 时刻 → 北京时间日历日 YYYY-MM-DD */
function shanghaiDateOf(utcValue) {
  const t = toDate(utcValue).getTime();
  if (Number.isNaN(t)) return null;
  const shanghai = new Date(t + SHANGHAI_OFFSET_MS);
  const y = shanghai.getUTCFullYear();
  const m = String(shanghai.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shanghai.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 会话统计归属日：按 started_at 的北京日历日（与 stats 路由 CONVERT_TZ 一致）
 * 整段时长计入「开始那天」，不拆到两天
 */
function sessionStatDay(startedAt) {
  return shanghaiDateOf(startedAt);
}

/**
 * 计划时间段是否与某北京日历日有交集
 * dayStr: YYYY-MM-DD（北京）
 */
function scheduleOverlapsShanghaiDay(startAt, endAt, dayStr) {
  // 北京 day 00:00 = UTC (day-1) 16:00
  const dayStartUtc = new Date(`${dayStr}T00:00:00+08:00`).getTime();
  const dayEndUtc = dayStartUtc + 24 * 60 * 60 * 1000;
  const s = toDate(startAt).getTime();
  const e = toDate(endAt).getTime();
  if ([s, e, dayStartUtc].some((x) => Number.isNaN(x))) return false;
  // 区间重叠：start < dayEnd && end > dayStart
  return s < dayEndUtc && e > dayStartUtc;
}

/** 计划是否跨北京日历日 */
function isCrossShanghaiDay(startAt, endAt) {
  const a = shanghaiDateOf(startAt);
  const b = shanghaiDateOf(endAt);
  if (!a || !b) return false;
  return a !== b;
}

/** ISO → MySQL UTC 字符串 */
function toMysqlUtcDatetime(value) {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/** 任务时长之和是否等于计划总工时 */
function tasksMatchPlanned(tasks, plannedMinutes) {
  if (!Array.isArray(tasks) || tasks.length === 0) return false;
  const sum = tasks.reduce((s, t) => s + Number(t.planned_minutes || 0), 0);
  return sum === Number(plannedMinutes);
}

module.exports = {
  SHANGHAI_OFFSET_MS,
  toDate,
  durationMinutes,
  shanghaiDateOf,
  sessionStatDay,
  scheduleOverlapsShanghaiDay,
  isCrossShanghaiDay,
  toMysqlUtcDatetime,
  tasksMatchPlanned,
};
