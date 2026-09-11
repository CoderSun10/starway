import { useToastStore } from '../stores/toastStore';

export default function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="toast-host">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type}`}
          onClick={() => dismiss(t.id)}
          role="status"
        >
          <strong>{t.text1}</strong>
          {t.text2 ? <span>{t.text2}</span> : null}
        </div>
      ))}
    </div>
  );
}
