const { query } = require('../db');

/** YYYY-MM-DD 往前/后挪 n 天 */
function shiftDay(ymd, n) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** 该日期所在周的周一（北京日历日） */
function mondayOf(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return shiftDay(ymd, -dow);
}

/** 闭区间涉及到的北京日历月，如 2026-08-15~2026-09-14 → ['2026-08','2026-09'] */
function monthsBetween(fromYmd, toYmd) {
  const out = [];
  let [y, m] = String(fromYmd).split('-').map(Number);
  const [ty, tm] = String(toYmd).split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** YYYY-MM → 当月最后一天 */
function monthEndOf(month) {
  const [y, m] = String(month).split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * 把固定支出展开成「发生日 + 金额」行的子查询。
 * 条目按 billing_month 归属月份；已付的记在付款日，其余记在当月应扣日
 * （31 号遇小月顺延到月底）。没记过的月份也按预计值计入。
 */
function expandSql(months) {
  const monthSelect = months.map(() => 'SELECT ? AS month').join(' UNION ALL ');
  return `SELECT COALESCE(
            r.paid_date,
            DATE_ADD(
              STR_TO_DATE(CONCAT(m.month, '-01'), '%Y-%m-%d'),
              INTERVAL LEAST(
                t.due_day,
                DAY(LAST_DAY(CONCAT(m.month, '-01')))
              ) - 1 DAY
            )
          ) AS day,
          COALESCE(r.amount_fen, t.expected_amount_fen) AS amount_fen
   FROM fixed_expenses t
   JOIN (${monthSelect}) m
     ON m.month = t.billing_month
   LEFT JOIN fixed_expense_records r
     ON r.fixed_expense_id = t.id
    AND r.billing_month = m.month
    AND r.user_id = t.user_id
   WHERE t.user_id = ? AND t.enabled = 1`;
}

/** 区间内固定支出的合计（分） */
async function fixedSpendInRange(uid, fromDay, toDay) {
  if (!fromDay || !toDay || fromDay > toDay) return 0;
  const months = monthsBetween(fromDay, toDay);
  if (!months.length) return 0;
  const rows = await query(
    `SELECT COALESCE(SUM(x.amount_fen), 0) AS total_fen
     FROM (${expandSql(months)}) x
     WHERE x.day >= ? AND x.day <= ?`,
    [...months, uid, fromDay, toDay]
  );
  return Number(rows[0].total_fen);
}

/** 区间内固定支出按天聚合：[{ day, spend_fen, expense_count }] */
async function fixedSpendByDayInRange(uid, fromDay, toDay) {
  if (!fromDay || !toDay || fromDay > toDay) return [];
  const months = monthsBetween(fromDay, toDay);
  if (!months.length) return [];
  const rows = await query(
    `SELECT x.day,
            COALESCE(SUM(x.amount_fen), 0) AS spend_fen,
            COUNT(*) AS expense_count
     FROM (${expandSql(months)}) x
     WHERE x.day >= ? AND x.day <= ?
     GROUP BY x.day`,
    [...months, uid, fromDay, toDay]
  );
  return rows.map((r) => ({
    day: String(r.day).slice(0, 10),
    spend_fen: Number(r.spend_fen),
    expense_count: Number(r.expense_count),
  }));
}

module.exports = {
  shiftDay,
  mondayOf,
  monthsBetween,
  monthEndOf,
  fixedSpendInRange,
  fixedSpendByDayInRange,
};
