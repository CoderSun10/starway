import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, useThemeStore } from '../stores/themeStore';
import { useSettingsStore } from '../stores/settingsStore';
import { THEME_LIST, themes } from '../constants/themes';
import { changePassword } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { APP_NAME_FULL, APP_SLOGAN } from '../constants/brand';
import {
  FEEDBACK_MODES,
  RINGTONE_PRESETS,
  previewFeedback,
} from '../utils/feedback';
import {
  Button,
  Chip,
  Field,
  NumericInput,
  TextInput,
} from '../components/ui';
import { toast } from '../stores/toastStore';

const NAV = [
  { id: 'account', label: '账号', hint: '登录与密码' },
  { id: 'appearance', label: '外观', hint: '主题配色' },
  { id: 'calendar', label: '日历', hint: '热力图' },
  { id: 'alerts', label: '提醒', hint: '计时结束' },
  { id: 'window', label: '窗口', hint: '托盘与开机' },
  { id: 'about', label: '关于', hint: '版本信息' },
];

function Row({ title, hint, children, danger }) {
  const t = useTheme();
  return (
    <div className="settings-row" style={{ borderColor: t.border }}>
      <div className="settings-row-copy">
        <div style={{ color: danger ? t.danger : t.text, fontWeight: 600 }}>
          {title}
        </div>
        {hint ? (
          <div className="settings-row-hint" style={{ color: t.textSecondary }}>
            {hint}
          </div>
        ) : null}
      </div>
      <div className="settings-row-action">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTheme();
  const themeId = useThemeStore((s) => s.themeId);
  const setThemeId = useThemeStore((s) => s.setThemeId);

  const feedbackMode = useSettingsStore((s) => s.feedbackMode);
  const ringtoneId = useSettingsStore((s) => s.ringtoneId);
  const minimizeToTray = useSettingsStore((s) => s.minimizeToTray);
  const openAtLogin = useSettingsStore((s) => s.openAtLogin);
  const setFeedbackMode = useSettingsStore((s) => s.setFeedbackMode);
  const setRingtoneId = useSettingsStore((s) => s.setRingtoneId);
  const setMinimizeToTray = useSettingsStore((s) => s.setMinimizeToTray);
  const setOpenAtLogin = useSettingsStore((s) => s.setOpenAtLogin);
  const heatmapTimeMax = useSettingsStore((s) => s.heatmapTimeMax);
  const heatmapSpendYuan = useSettingsStore((s) => s.heatmapSpendYuan);
  const setHeatmapTimeMax = useSettingsStore((s) => s.setHeatmapTimeMax);
  const setHeatmapSpendYuan = useSettingsStore((s) => s.setHeatmapSpendYuan);
  const hydrateDesktop = useSettingsStore((s) => s.hydrateDesktop);

  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clear);
  const [section, setSection] = useState('account');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [platform, setPlatform] = useState('web');
  const [isElectron, setIsElectron] = useState(false);

  const current = NAV.find((n) => n.id === section) || NAV[0];

  useEffect(() => {
    hydrateDesktop();
    if (window.starwayDesktop?.getInfo) {
      setIsElectron(true);
      window.starwayDesktop.getInfo().then((info) => {
        setPlatform(info.platform || 'electron');
      });
    }
  }, [hydrateDesktop]);

  const onPreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      const r = await previewFeedback({ mode: feedbackMode, ringtoneId });
      if (feedbackMode !== 'none' && feedbackMode !== 'notify' && r?.soundOk === false) {
        toast.error('铃声播放失败');
      } else {
        toast.success('已试听当前效果');
      }
    } catch (e) {
      toast.error('试听失败', e?.message);
    } finally {
      setPreviewing(false);
    }
  };

  const pane = (() => {
    if (section === 'account') {
      return (
        <>
          <Row title="当前账号" hint="登录用的邮箱">
            <span style={{ color: t.text }}>{user?.email || '未登录'}</span>
          </Row>
          <div className="settings-block">
            <div className="settings-block-title" style={{ color: t.textSecondary }}>
              修改密码
            </div>
            <Field label="当前密码">
              <TextInput
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field label="新密码">
              <TextInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="至少 8 位"
              />
            </Field>
            <Button
              variant="outline"
              disabled={savingPw}
              onClick={async () => {
                setSavingPw(true);
                try {
                  await changePassword({ currentPassword, newPassword });
                  setCurrentPassword('');
                  setNewPassword('');
                  toast.success('密码已修改');
                } catch (e) {
                  toast.error(e.message || '修改失败');
                } finally {
                  setSavingPw(false);
                }
              }}
            >
              {savingPw ? '保存中…' : '保存新密码'}
            </Button>
          </div>
          <Row title="退出登录" hint="不会删除云端数据" danger>
            <Button
              variant="danger"
              onClick={() => {
                clearAuth();
                toast.info('已退出登录');
                nav('/login', { replace: true });
              }}
            >
              退出
            </Button>
          </Row>
        </>
      );
    }

    if (section === 'appearance') {
      return (
        <div className="theme-grid">
          {THEME_LIST.map((item) => {
            const th = themes[item.id];
            const on = themeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`theme-tile${on ? ' on' : ''}`}
                onClick={() => setThemeId(item.id)}
                style={{
                  borderColor: on ? t.primary : t.border,
                  background: t.bgElevated,
                  color: t.text,
                  boxShadow: on ? `0 0 0 3px ${t.primarySoft}` : 'none',
                }}
              >
                <span
                  className="theme-swatch"
                  style={{ background: th.bg, borderColor: th.border }}
                >
                  <i style={{ background: th.sidebar }} />
                  <i style={{ background: th.primary }} />
                  <i style={{ background: th.accent }} />
                </span>
                <strong>{item.name}</strong>
                {on ? (
                  <span className="theme-on" style={{ color: t.primary }}>
                    使用中
                  </span>
                ) : (
                  <span className="theme-on" style={{ color: t.muted }}>
                    点击应用
                  </span>
                )}
              </button>
            );
          })}
        </div>
      );
    }

    if (section === 'calendar') {
      return (
        <>
          <p className="settings-lead" style={{ color: t.textSecondary }}>
            日历切到「热力图」后，格子深浅按当天数值相对满格值计算。
          </p>
          <Row title="时间满格" hint="当天专注达到这个分钟数即为最深色">
            <NumericInput
              min={15}
              max={600}
              value={heatmapTimeMax ?? 120}
              onCommit={setHeatmapTimeMax}
              style={{ width: 120 }}
            />
          </Row>
          <Row title="花费满格" hint="当天支出达到这个金额（元）即为最深色">
            <NumericInput
              min={1}
              max={100000}
              value={heatmapSpendYuan ?? 100}
              onCommit={setHeatmapSpendYuan}
              style={{ width: 120 }}
            />
          </Row>
        </>
      );
    }

    if (section === 'alerts') {
      return (
        <>
          <p className="settings-lead" style={{ color: t.textSecondary }}>
            计时结束时的本地提示，不依赖外网。
          </p>
          <Row title="提醒方式" hint="声音、系统通知，或两者一起">
            <div className="chip-row">
              {FEEDBACK_MODES.map((m) => (
                <Chip
                  key={m.id}
                  active={feedbackMode === m.id}
                  onClick={() => setFeedbackMode(m.id)}
                >
                  {m.label}
                </Chip>
              ))}
            </div>
          </Row>
          {(feedbackMode === 'both' || feedbackMode === 'sound') && (
            <Row title="铃声" hint="结束时播放的提示音">
              <div className="chip-row">
                {RINGTONE_PRESETS.map((r) => (
                  <Chip
                    key={r.id}
                    active={ringtoneId === r.id}
                    onClick={() => setRingtoneId(r.id)}
                  >
                    {r.label}
                  </Chip>
                ))}
              </div>
            </Row>
          )}
          {feedbackMode !== 'none' ? (
            <Row title="试听" hint="按当前方式和铃声播一次">
              <Button variant="ghost" onClick={onPreview} disabled={previewing}>
                {previewing ? '试听中…' : '试听'}
              </Button>
            </Row>
          ) : null}
        </>
      );
    }

    if (section === 'window') {
      return (
        <>
          {!isElectron ? (
            <p className="settings-lead" style={{ color: t.muted }}>
              当前是浏览器预览，托盘和开机启动只在桌面窗口里生效。
            </p>
          ) : (
            <p className="settings-lead" style={{ color: t.textSecondary }}>
              只影响这台电脑上的星程窗口。
            </p>
          )}
          <Row title="关闭到托盘" hint="点关闭时不退出，放到系统托盘">
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={minimizeToTray}
                onChange={(e) => setMinimizeToTray(e.target.checked)}
              />
              <i />
            </label>
          </Row>
          <Row title="开机启动" hint="登录系统后自动打开星程">
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={openAtLogin}
                onChange={(e) => setOpenAtLogin(e.target.checked)}
              />
              <i />
            </label>
          </Row>
        </>
      );
    }

    return (
      <div className="settings-about">
        <strong style={{ color: t.text, fontSize: 18 }}>{APP_NAME_FULL}</strong>
        <p style={{ color: t.textSecondary, margin: '6px 0 16px' }}>{APP_SLOGAN}</p>
        <Row title="版本" hint="桌面端">
          <span style={{ color: t.text }}>1.0.0</span>
        </Row>
        <Row title="运行平台" hint="当前窗口所在系统">
          <span style={{ color: t.text }}>{platform}</span>
        </Row>
      </div>
    );
  })();

  return (
    <div className="settings-page" style={{ ['--settings-accent']: t.primary }}>
      <div className="settings-head">
        <h1 className="page-title" style={{ color: t.text }}>
          设置
        </h1>
        <p className="page-sub" style={{ color: t.textSecondary }}>
          {current.label} · {current.hint}
        </p>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分类">
          {NAV.map((item) => {
            const on = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item${on ? ' on' : ''}`}
                onClick={() => setSection(item.id)}
                style={{
                  color: on ? t.sidebarActive : t.text,
                  background: on ? t.primarySoft : 'transparent',
                }}
              >
                <span>{item.label}</span>
                <small style={{ color: on ? t.primary : t.textSecondary }}>
                  {item.hint}
                </small>
              </button>
            );
          })}
        </nav>
        <div
          key={section}
          className="settings-pane"
          style={{ background: t.bgElevated, borderColor: t.border }}
        >
          <h2 className="settings-pane-title" style={{ color: t.text }}>
            {current.label}
          </h2>
          {pane}
        </div>
      </div>
    </div>
  );
}
