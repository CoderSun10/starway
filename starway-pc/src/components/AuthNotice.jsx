export default function AuthNotice({ type = 'info', children }) {
  if (!children) return null;
  return (
    <div className={`auth-notice auth-notice-${type}`} role="status">
      {children}
    </div>
  );
}

export function AuthSuccessMask({ title, sub }) {
  return (
    <div className="auth-ok-mask" role="status">
      <div className="auth-ok-mark" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5l4.2 4.2L19 7.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <strong>{title}</strong>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}
