import { create } from 'zustand';

let seq = 0;

export const useToastStore = create((set, get) => ({
  items: [],

  show(type, text1, text2 = '') {
    const id = ++seq;
    set((s) => ({
      items: [...s.items, { id, type, text1, text2 }],
    }));
    setTimeout(() => get().dismiss(id), 3200);
  },

  dismiss(id) {
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
  },
}));

export const toast = {
  success: (t1, t2) => useToastStore.getState().show('success', t1, t2),
  error: (t1, t2) => useToastStore.getState().show('error', t1, t2),
  info: (t1, t2) => useToastStore.getState().show('info', t1, t2),
};
