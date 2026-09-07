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

export function ProgressBar({ current = 0, total = 1, label }) {
  const t = useTheme();
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div>
      {label ? (
        <div className="row-between" style={{ marginBottom: 6 }}>
          <span className="muted" style={{ color: t.textSecondary }}>
            {label}
          </span>
          <strong style={{ color: t.primary, fontSize: 12 }}>{pct}%</strong>
        </div>
      ) : null}
      <div className="progress" style={{ background: t.progressTrack }}>
        <i style={{ width: `${pct}%`, background: t.progressFill }} />
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
