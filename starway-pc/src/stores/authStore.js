import { create } from 'zustand';
import { storageGet, storageSet } from '../utils/storage';

const USER_KEY = 'starway_auth_user';
const TOKEN_KEY = 'starway_auth_token';
const ACTIVE_KEY = 'starway_auth_active_at';

// 多久没动静就当作登录失效。关掉软件这段时间也算「没动静」，
// 所以离线超过这个时长再打开，会停在登录页而不是直接进主页。
export const IDLE_LIMIT_MS = 60 * 60 * 1000;

// touch() 的写入节流，避免鼠标移动时狂写 localStorage
export const TOUCH_THROTTLE_MS = 30 * 1000;

function readUser() {
  try {
    const raw = storageGet(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readActiveAt() {
  const raw = Number(storageGet(ACTIVE_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function isIdleTooLong(token, activeAt) {
  if (!token) return false;
  // 没有时间戳说明是加这个功能之前留下的登录态，无从判断活跃时间，
  // 按失效处理，让它回登录页重新登一次。
  if (!activeAt) return true;
  return Date.now() - activeAt > IDLE_LIMIT_MS;
}

const bootToken = storageGet(TOKEN_KEY) || null;
const bootActiveAt = readActiveAt();
// 没有 token，或者离线太久，都算没登录：顺手把残留的 user 也清掉
const bootExpired = !bootToken || isIdleTooLong(bootToken, bootActiveAt);

if (bootExpired) {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

export const useAuthStore = create((set, get) => ({
  user: bootExpired ? null : readUser(),
  accessToken: bootExpired ? null : bootToken,
  lastActiveAt: bootExpired ? 0 : bootActiveAt,

  setSession: ({ user, accessToken }) => {
    const now = Date.now();
    storageSet(USER_KEY, JSON.stringify(user || null));
    storageSet(TOKEN_KEY, accessToken || '');
    storageSet(ACTIVE_KEY, String(now));
    set({ user, accessToken, lastActiveAt: now });
  },

  updateUser: (user) => {
    storageSet(USER_KEY, JSON.stringify(user || null));
    set({ user });
  },

  /** 记录一次活跃。节流后写入，用于判断是否离线太久。 */
  touch: () => {
    if (!get().accessToken) return;
    const now = Date.now();
    if (now - get().lastActiveAt < TOUCH_THROTTLE_MS) return;
    storageSet(ACTIVE_KEY, String(now));
    set({ lastActiveAt: now });
  },

  /** 是否已经离线超过上限。 */
  isIdleExpired: () => {
    const { accessToken, lastActiveAt } = get();
    if (!accessToken) return false;
    return Date.now() - lastActiveAt > IDLE_LIMIT_MS;
  },

  clear: () => {
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // ignore
    }
    set({ user: null, accessToken: null, lastActiveAt: 0 });
  },

  isAuthenticated: () => Boolean(get().accessToken),
}));
