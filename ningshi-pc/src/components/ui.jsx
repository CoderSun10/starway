import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../stores/themeStore';

export function Card({ children, style, className = '' }) {
  const t = useTheme();
  return (
    <div
      className={`card ${className}`.trim()}
      style={{
        background: t.bgElevated,
        borderColor: t.border,
        boxShadow:
          t.id === 'slate'
            ? '0 4px 18px rgba(18,24,38,0.06)'
            : `0 8px 28px ${t.glow}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function IconButton({ name, onClick, title, danger, disabled }) {
  const t = useTheme();
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  let icon = null;
  if (name === 'edit') {
    icon = (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    );
  } else if (name === 'trash') {
    icon = (
      <svg {...common}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    );
  } else if (name === 'fold') {
    icon = (
      <svg {...common}>
        <path d="M6 14l6-6 6 6" />
      </svg>
    );
  }
  return (
    <button
      type="button"
      className="icon-btn"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        color: danger ? t.danger : t.textSecondary,
        borderColor: t.border,
        background: 'transparent',
      }}
    >
      {icon}
    </button>
  );
}

export function Button({
  children,
  variant = 'primary',
  onClick,
  disabled,
  type = 'button',
  style,
  className = '',
}) {
  const t = useTheme();
  let bg = t.primary;
  let color = t.buttonText;
  let border = 'transparent';

  if (variant === 'outline') {
    bg = 'transparent';
    color = t.primary;
    border = t.primary;
  } else if (variant === 'ghost') {
    bg = t.primarySoft;
    color = t.primary;
  } else if (variant === 'danger') {
    bg = t.danger;
    color = '#fff';
  } else if (variant === 'accent') {
    bg = t.accent;
    color = t.buttonText;
  }

  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      disabled={disabled}
      onClick={onClick}
      style={{ background: bg, color, borderColor: border, ...style }}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ current = 0, total = 1, label, tone, percent, fill }) {
  const t = useTheme();
  const raw = total > 0 ? Math.round((current / total) * 100) : 0;
  const shown = percent != null ? percent : raw;
  const width = Math.min(100, Math.max(0, raw));
  const over = tone === 'danger' || (total > 0 && current > total);
  const done = !over && total > 0 && current >= total;
  const barColor = over
    ? t.danger
    : done
      ? t.success
      : fill || t.progressFill;
  return (
    <div className="progress-wrap">
      {label ? (
        <div className="row-between" style={{ marginBottom: 4 }}>
          <span className="muted" style={{ color: t.textSecondary, fontSize: 12 }}>
            {label}
          </span>
          <strong style={{ color: barColor, fontSize: 12 }}>
            {shown}%
          </strong>
        </div>
      ) : null}
      <div className="progress" style={{ background: t.progressTrack }}>
        <i style={{ width: `${width}%`, background: barColor }} />
      </div>
    </div>
  );
}

export function Empty({ title, subtitle }) {
  const t = useTheme();
  return (
    <div className="empty">
      <h3 style={{ color: t.text }}>{title}</h3>
      {subtitle ? (
        <p style={{ color: t.textSecondary }}>{subtitle}</p>
      ) : null}
    </div>
  );
}

export function Field({ label, children }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 12 }}>
      {label ? (
        <label className="label" style={{ color: t.textSecondary }}>
          {label}
        </label>
      ) : null}
      {children}
    </div>
  );
}

export function TextInput(props) {
  const t = useTheme();
  return (
    <input
      className="input"
      {...props}
      style={{
        borderColor: t.border,
        background: t.inputBg,
        color: t.text,
        ...(props.style || {}),
      }}
    />
  );
}

/** 数字框：输入中可全部删掉再重填；失焦后才按 min/max 收口 */
export function NumericInput({
  value,
  onChange,
  onCommit,
  min,
  max,
  integer = true,
  disabled,
  style,
  className = '',
}) {
  const t = useTheme();
  const committed = value === '' || value == null ? '' : String(value);
  const [text, setText] = useState(committed);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(committed);
  }, [committed]);

  function sanitize(raw) {
    if (integer) return String(raw).replace(/[^\d]/g, '');
    const s = String(raw).replace(/[^\d.]/g, '');
    const i = s.indexOf('.');
    if (i === -1) return s;
    return s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
  }

  function parse(raw) {
    if (raw === '' || raw === '.') return null;
    const n = integer ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function clamp(n) {
    let x = n;
    if (min != null && x < min) x = min;
    if (max != null && x > max) x = max;
    return integer ? Math.round(x) : x;
  }

  return (
    <input
      className={`input ${className}`.trim()}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      disabled={disabled}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const next = sanitize(e.target.value);
        setText(next);
        onChange?.(next);
      }}
      onBlur={() => {
        focused.current = false;
        const n = parse(text);
        if (n == null) {
          setText(committed);
          onChange?.(committed);
          return;
        }
        const x = clamp(n);
        setText(String(x));
        onChange?.(String(x));
        onCommit?.(x);
      }}
      style={{
        borderColor: t.border,
        background: t.inputBg,
        color: t.text,
        ...(style || {}),
      }}
    />
  );
}

export function TextArea(props) {
  const t = useTheme();
  return (
    <textarea
      className="textarea"
      {...props}
      style={{
        borderColor: t.border,
        background: t.inputBg,
        color: t.text,
        ...(props.style || {}),
      }}
    />
  );
}

export function Chip({ active, children, onClick }) {
  const t = useTheme();
  return (
    <button
      type="button"
      className="chip"
      onClick={onClick}
      style={{
        borderColor: active ? t.primary : t.border,
        background: active ? t.primarySoft : 'transparent',
        color: active ? t.primary : t.textSecondary,
      }}
    >
      {children}
    </button>
  );
}

export function PageHeader({ title, sub, right }) {
  const t = useTheme();
  return (
    <div className="row-between" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
      <div>
        <h1 className="page-title" style={{ color: t.text }}>
          {title}
        </h1>
        {sub ? (
          <p className="page-sub" style={{ color: t.textSecondary }}>
            {sub}
          </p>
        ) : (
          <div style={{ height: 12 }} />
        )}
      </div>
      {right}
    </div>
  );
}

export function Loading({ text = '加载中…' }) {
  const t = useTheme();
  return (
    <div className="empty" style={{ color: t.textSecondary }}>
      {text}
    </div>
  );
}
