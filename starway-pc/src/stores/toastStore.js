import { create } from 'zustand';

let seq = 0;

export const useToastStore = create((set, get) => ({
  items: [],

  show(type, text1, text2 = '') {
    const id = ++seq;
    set((s) => ({
      items: [...s.items, { id, type, text1, text2, leaving: false }],
    }));
    setTimeout(() => {
      set((s) => ({
        items: s.items.map((x) => (x.id === id ? { ...x, leaving: true } : x)),
      }));
    }, 2600);
    setTimeout(() => get().dismiss(id), 3000);
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
