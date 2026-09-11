/**
 * 单元测试：跨天、时长、北京日历日归属、边界值
 */
const {
  durationMinutes,
  shanghaiDateOf,
  sessionStatDay,
  scheduleOverlapsShanghaiDay,
  isCrossShanghaiDay,
  toMysqlUtcDatetime,
  tasksMatchPlanned,
  parseYmd,
  inclusiveDayCount,
  visibleMonthRange,
} = require('../../src/utils/timeLogic');

describe('durationMinutes — 跨天时长与同日一致算法', () => {
  test('同日 2 小时 = 120 分钟', () => {
    expect(
      durationMinutes('2026-07-18T02:00:00.000Z', '2026-07-18T04:00:00.000Z')
    ).toBe(120);
  });

  test('跨天：北京 23:00 → 次日 01:00 = 120 分钟（与同日 2h 相同）', () => {
    // 北京 7/18 23:00 = UTC 7/18 15:00
    // 北京 7/19 01:00 = UTC 7/18 17:00
    expect(
      durationMinutes('2026-07-18T15:00:00.000Z', '2026-07-18T17:00:00.000Z')
    ).toBe(120);
  });

  test('跨天长区间：北京 7/18 22:00 → 7/19 06:00 = 8 小时', () => {
    // 22:00 CST = 14:00 UTC; 06:00 next = 22:00 UTC same calendar UTC day? 
    // 7/19 06:00 CST = 7/18 22:00 UTC
    expect(
      durationMinutes('2026-07-18T14:00:00.000Z', '2026-07-18T22:00:00.000Z')
    ).toBe(480);
  });

  test('MySQL UTC 字符串格式亦可算时长', () => {
    expect(
      durationMinutes('2026-07-18 15:00:00', '2026-07-18 17:00:00')
    ).toBe(120);
  });

  test('结束早于开始 → 负分钟（调用方应拒绝）', () => {
    expect(
      durationMinutes('2026-07-18T17:00:00.000Z', '2026-07-18T15:00:00.000Z')
    ).toBe(-120);
  });

  test('无效时间 → null', () => {
    expect(durationMinutes('bad', '2026-07-18T15:00:00.000Z')).toBeNull();
  });
});

describe('shanghaiDateOf / sessionStatDay — 会话统计归属', () => {
  test('UTC 08:00 → 北京 16:00 同一天', () => {
    expect(shanghaiDateOf('2026-07-18T08:00:00.000Z')).toBe('2026-07-18');
  });

  test('UTC 16:30 → 北京次日 00:30（跨日边界）', () => {
    // 16:30 UTC + 8h = 00:30 next day
    expect(shanghaiDateOf('2026-07-18T16:30:00.000Z')).toBe('2026-07-19');
  });

  test('UTC 15:59 → 仍为北京 7/18 23:59', () => {
    expect(shanghaiDateOf('2026-07-18T15:59:00.000Z')).toBe('2026-07-18');
  });

  test('UTC 16:00 整点 → 北京 7/19 00:00', () => {
    expect(shanghaiDateOf('2026-07-18T16:00:00.000Z')).toBe('2026-07-19');
  });

  test('会话整段时长计入 started_at 的北京日，不拆两天', () => {
    // 开始北京 7/18 23:30，持续 90 分钟到 7/19 01:00
    const start = '2026-07-18T15:30:00.000Z'; // 23:30 CST
    expect(sessionStatDay(start)).toBe('2026-07-18');
    // 即使结束在次日，统计日仍是开始日
    expect(sessionStatDay(start)).not.toBe('2026-07-19');
  });
});

describe('isCrossShanghaiDay / scheduleOverlapsShanghaiDay — 跨天计划', () => {
  // 计划：北京 7/18 22:00 → 7/19 02:00
  const start = '2026-07-18T14:00:00.000Z';
  const end = '2026-07-18T18:00:00.000Z';

  test('识别为跨北京日历日', () => {
    expect(isCrossShanghaiDay(start, end)).toBe(true);
  });

  test('同日计划不跨天', () => {
    expect(
      isCrossShanghaiDay(
        '2026-07-18T02:00:00.000Z',
        '2026-07-18T10:00:00.000Z'
      )
    ).toBe(false);
  });

  test('跨天计划与第一天有交集', () => {
    expect(scheduleOverlapsShanghaiDay(start, end, '2026-07-18')).toBe(true);
  });

  test('跨天计划与第二天有交集', () => {
    expect(scheduleOverlapsShanghaiDay(start, end, '2026-07-19')).toBe(true);
  });

  test('与无关日期无交集', () => {
    expect(scheduleOverlapsShanghaiDay(start, end, '2026-07-17')).toBe(false);
    expect(scheduleOverlapsShanghaiDay(start, end, '2026-07-20')).toBe(false);
  });

  test('恰好贴在日边界：结束=次日 00:00 仍算与第一天重叠', () => {
    // 北京 7/18 00:00 → 7/19 00:00
    const s = '2026-07-17T16:00:00.000Z';
    const e = '2026-07-18T16:00:00.000Z';
    expect(scheduleOverlapsShanghaiDay(s, e, '2026-07-18')).toBe(true);
    // 结束时刻等于 7/19 00:00，end > dayStart(7/19) 为 false，不计入 7/19
    expect(scheduleOverlapsShanghaiDay(s, e, '2026-07-19')).toBe(false);
  });
});

describe('toMysqlUtcDatetime', () => {
  test('ISO 转 MySQL UTC 字符串', () => {
    expect(toMysqlUtcDatetime('2026-07-18T15:00:00.000Z')).toBe(
      '2026-07-18 15:00:00'
    );
  });
});

describe('tasksMatchPlanned — 边界', () => {
  test('相等通过', () => {
    expect(
      tasksMatchPlanned(
        [
          { planned_minutes: 30 },
          { planned_minutes: 30 },
        ],
        60
      )
    ).toBe(true);
  });

  test('不相等失败', () => {
    expect(tasksMatchPlanned([{ planned_minutes: 20 }], 60)).toBe(false);
  });

  test('空任务失败', () => {
    expect(tasksMatchPlanned([], 60)).toBe(false);
  });

  test('边界：0 分钟总工时 + 空 → 失败', () => {
    expect(tasksMatchPlanned([], 0)).toBe(false);
  });
});

describe('parseYmd / inclusiveDayCount', () => {
  test('拒绝 02-31', () => {
    expect(parseYmd('2026-02-31')).toBe(null);
  });
  test('同日 = 1', () => {
    expect(inclusiveDayCount('2026-09-10', '2026-09-10')).toBe(1);
  });
  test('2026-01-01 到 2027-01-01 = 366', () => {
    expect(inclusiveDayCount('2026-01-01', '2027-01-01')).toBe(366);
  });
  test('跨度 367 拒绝', () => {
    expect(inclusiveDayCount('2024-01-01', '2025-01-01')).toBe(367);
  });
});

describe('visibleMonthRange', () => {
  test('2026-09 周二 1 号 → 去掉整行下月，35 天', () => {
    const r = visibleMonthRange(2026, 9);
    expect(r).toEqual({ from: '2026-08-31', to: '2026-10-04' });
    expect(inclusiveDayCount(r.from, r.to)).toBe(35);
  });
  test('2026-03 周日 1 号仍需 6 行盖住 31 号', () => {
    const r = visibleMonthRange(2026, 3);
    expect(r).toEqual({ from: '2026-02-23', to: '2026-04-05' });
    expect(inclusiveDayCount(r.from, r.to)).toBe(42);
  });
});
