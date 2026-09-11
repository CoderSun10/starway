/** keep in sync with backend/src/utils/money.js */

export function yuanToFen(input) {
  const s = String(input ?? '')
    .trim()
    .replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [w, frac = ''] = s.split('.');
  if (w.length > 8) return null;
  const fen = Number(w) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isFinite(fen) || fen < 1 || fen > 1_000_000_000) return null;
  return fen;
}

export function fenToYuanString(fen) {
  const n = Number(fen) || 0;
  const neg = n < 0;
  const a = Math.abs(n);
  const y = Math.floor(a / 100);
  const f = a % 100;
  const grouped = Math.abs(y).toLocaleString('zh-CN');
  const sign = neg ? '-' : '';
  const body = f === 0 ? grouped : `${grouped}.${String(f).padStart(2, '0')}`;
  return sign + body;
}

export function formatFen(fen) {
  return `¥${fenToYuanString(fen)}`;
}

export function yuanInputNormalize(raw) {
  const s = String(raw ?? '').trim().replace(/,/g, '');
  if (!s) return '';
  const fen = yuanToFen(s);
  if (fen == null) return s;
  return fenToYuanString(fen).replace(/,/g, '');
}
