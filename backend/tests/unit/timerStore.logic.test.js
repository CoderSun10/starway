/**
 * 前端 timer 墙钟逻辑的纯 JS 复刻测试（不引入 RN）
 * 对应 src/stores/timerStore 的 endsAtMs 算法
 */

function createTimerLogic() {
  let state = {
    plannedMinutes: 45,
    remainingSeconds: 45 * 60,
    status: 'idle',
    endsAtMs: null,
  };

  return {
    getState: () => ({ ...state }),
    start(now = Date.now()) {
      if (state.remainingSeconds <= 0) return;
      state = {
        ...state,
        status: 'running',
        endsAtMs: now + state.remainingSeconds * 1000,
      };
    },
    tick(now = Date.now()) {
      if (state.status !== 'running' || state.endsAtMs == null) {
        return state.remainingSeconds;
      }
      const next = Math.max(0, Math.ceil((state.endsAtMs - now) / 1000));
      state.remainingSeconds = next;
      if (next <= 0) {
        state.status = 'finished';
        state.endsAtMs = null;
      }
      return next;
    },
    setMinutes(m) {
      state.plannedMinutes = m;
      state.remainingSeconds = m * 60;
      state.status = 'idle';
      state.endsAtMs = null;
    },
  };
}

describe('timer wall-clock（后台不丢进度）', () => {
  test('模拟后台 10 秒：回来剩余正确减少', () => {
    const t = createTimerLogic();
    t.setMinutes(1); // 60s
    const t0 = 1_000_000;
    t.start(t0);
    // 后台挂起 10 秒
    const left = t.tick(t0 + 10_000);
    expect(left).toBe(50);
    expect(t.getState().status).toBe('running');
  });

  test('后台挂到超时：状态 finished', () => {
    const t = createTimerLogic();
    t.setMinutes(1);
    const t0 = 1_000_000;
    t.start(t0);
    const left = t.tick(t0 + 70_000);
    expect(left).toBe(0);
    expect(t.getState().status).toBe('finished');
  });

  test('跨天墙钟：从 23:59 跑到次日，按绝对时间算', () => {
    const t = createTimerLogic();
    t.setMinutes(5);
    // 任意绝对时刻
    const t0 = Date.parse('2026-07-18T15:59:00.000Z'); // 北京 23:59
    t.start(t0);
    // 3 分钟后（已跨北京日）
    const left = t.tick(t0 + 3 * 60 * 1000);
    expect(left).toBe(2 * 60);
  });
});
