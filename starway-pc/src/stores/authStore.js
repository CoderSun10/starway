import { create } from 'zustand';
import { storageGet, storageSet } from '../utils/storage';

const USER_KEY = 'starway_auth_user';
const TOKEN_KEY = 'starway_auth_token';

function readUser() {
  try {
    const raw = storageGet(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create((set, get) => ({
  user: readUser(),
  accessToken: storageGet(TOKEN_KEY) || null,

  setSession: ({ user, accessToken }) => {
    storageSet(USER_KEY, JSON.stringify(user || null));
    storageSet(TOKEN_KEY, accessToken || '');
    set({ user, accessToken });
  },

  updateUser: (user) => {
    storageSet(USER_KEY, JSON.stringify(user || null));
    set({ user });
  },

  clear: () => {
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    set({ user: null, accessToken: null });
  },

  isAuthenticated: () => Boolean(get().accessToken),
}));
