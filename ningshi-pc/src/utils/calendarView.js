import { parseUtc } from './time';

export function scheduleCoversDay(schedule, dayStr) {
  const a = parseUtc(schedule.start_at);
  const b = parseUtc(schedule.end_at);
  if (!a?.isValid() || !b?.isValid()) return false;
  const start = new Date(`${dayStr}T00:00:00+08:00`).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return a.valueOf() < end && b.valueOf() > start;
}

export function budgetCoversDay(period, dayStr) {
  return period.start_date <= dayStr && period.end_date >= dayStr;
}

export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return { r: 128, g: 128, b: 128 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function darken(rgb, amount) {
  return {
    r: rgb.r * (1 - amount),
    g: rgb.g * (1 - amount),
    b: rgb.b * (1 - amount),
  };
}

/**
 * 6 档离散热力（含空档），用实色而不是半透明叠底，档与档差得开。
 * 0 空 → 1 浅 → 2 → 3 → 4 → 5 最深
 */
export function heatStep(value, max) {
  const v = Math.max(0, Number(value) || 0);
  const m = Math.max(1, Number(max) || 1);
  if (v <= 0) return 0;
  const r = v / m;
  if (r < 0.18) return 1;
  if (r < 0.36) return 2;
  if (r < 0.55) return 3;
  if (r < 0.78) return 4;
  return 5;
}

export function heatPalette(primaryHex, emptyBg) {
  const p = hexToRgb(primaryHex);
  const white = { r: 255, g: 255, b: 255 };
  return [
    emptyBg || '#f4f6fa',
    toHex(mixRgb(white, p, 0.28)),
    toHex(mixRgb(white, p, 0.48)),
    toHex(mixRgb(white, p, 0.7)),
    toHex(p),
    toHex(darken(p, 0.28)),
  ];
}

export function heatFillSolid(value, max, primaryHex, emptyBg) {
  const step = heatStep(value, max);
  return heatPalette(primaryHex, emptyBg)[step];
}

export function heatTextColor(step) {
  return step >= 4 ? '#ffffff' : null;
}
