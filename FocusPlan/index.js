import { BackHandler } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';

/**
 * RN 0.81+ 已移除 BackHandler.removeEventListener，
 * 部分旧库仍会调用。补上兼容实现，避免运行时报错。
 */
if (typeof BackHandler.removeEventListener !== 'function') {
  const subscriptions = new Map();
  const originalAdd = BackHandler.addEventListener.bind(BackHandler);

  BackHandler.addEventListener = (eventName, handler) => {
    const sub = originalAdd(eventName, handler);
    if (!subscriptions.has(eventName)) {
      subscriptions.set(eventName, new Set());
    }
    subscriptions.get(eventName).add({ handler, sub });
    return sub;
  };

  BackHandler.removeEventListener = (eventName, handler) => {
    const set = subscriptions.get(eventName);
    if (!set) return;
    for (const item of set) {
      if (item.handler === handler) {
        try {
          item.sub?.remove?.();
        } catch {
          // ignore
        }
        set.delete(item);
        break;
      }
    }
  };
}

registerRootComponent(App);
