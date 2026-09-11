/** 一级导航共用同一套 18×18 描边图标，避免 Unicode 字形大小不一 */
export default function NavIcon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (name === 'cal') {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
        <path d="M3.5 10h17M8 3.5v3.5M16 3.5v3.5" />
      </svg>
    );
  }
  if (name === 'time') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.2" />
        <path d="M12 7.5V12l3.2 2" />
      </svg>
    );
  }
  if (name === 'money') {
    return <span className="nav-yen">¥</span>;
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M6.1 17.9l1.6-1.6M16.3 7.7l1.6-1.6" />
    </svg>
  );
}
