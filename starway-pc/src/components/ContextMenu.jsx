import { useEffect, useRef } from 'react';
import { useTheme } from '../stores/themeStore';

/**
 * 右键菜单。页面自己 onContextMenu 打开并传坐标。
 * items: [{ id, label, hint?, danger?, disabled?, onSelect }]
 * x 为 null 时不渲染。
 */
export default function ContextMenu({ x, y, items = [], onClose }) {
  const t = useTheme();
  const ref = useRef(null);

  useEffect(() => {
    if (x == null) return undefined;
    // 捕获阶段监听，点到菜单外面就关
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [x, onClose]);

  if (x == null) return null;

  // 贴着右/下边缘时把菜单推回可视区
  const W = 180;
  const H = items.length * 34 + 8;
  const left = Math.max(4, Math.min(x, window.innerWidth - W - 8));
  const top = Math.max(4, Math.min(y, window.innerHeight - H - 8));

  return (
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      style={{
        left,
        top,
        background: t.bgElevated,
        borderColor: t.border,
        color: t.text,
      }}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          className="ctx-item"
          disabled={it.disabled}
          onClick={() => {
            onClose();
            it.onSelect?.();
          }}
          style={{ color: it.danger ? t.danger : t.text }}
        >
          <span>{it.label}</span>
          {it.hint ? <span className="ctx-hint">{it.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}
