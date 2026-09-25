import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, useThemeStore } from '../stores/themeStore';
import { useSettingsStore } from '../stores/settingsStore';
import { THEME_LIST, themes } from '../constants/themes';
import { changePassword } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { APP_NAME_FULL, APP_SLOGAN } from '../constants/brand';
import {
  APP_VERSION,
  fetchLatestRelease,
  formatSize,
  isNewer,
  pickAssets,
} from '../utils/update';
import {
  FEEDBACK_MODES,
  RINGTONE_PRESETS,
  previewFull,
} from '../utils/feedback';
import {
  Button,
  Chip,
  Field,
  NumericInput,
  ProgressBar,
  TextInput,
} from '../components/ui';
import { toast } from '../stores/toastStore';
import { RELEASE_NOTES } from '../constants/changelog';

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
  const [update, setUpdate] = useState({ phase: 'idle' });
  const [updateOpen, setUpdateOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [download, setDownload] = useState({ phase: 'idle' });

  const current = NAV.find((n) => n.id === section) || NAV[0];

  // 「关闭」选项已下线：旧配置是 none 的话迁移成 both
  useEffect(() => {
    if (feedbackMode === 'none') setFeedbackMode('both');
  }, [feedbackMode, setFeedbackMode]);

  useEffect(() => {
    hydrateDesktop();
    if (window.starwayDesktop?.getInfo) {
      setIsElectron(true);
      window.starwayDesktop.getInfo().then((info) => {
        setPlatform(info.platform || 'electron');
      });
    }
  }, [hydrateDesktop]);

  useEffect(() => {
    const off = window.starwayDesktop?.onUpdateProgress?.((p) => {
      setDownload((prev) =>
        prev.phase === 'downloading'
          ? { ...prev, percent: p.percent || 0, received: p.received, total: p.total }
          : prev
      );
    });
    return off;
  }, []);

  const openLink = (url) => {
    const desktop = window.starwayDesktop;
    if (desktop?.openExternal) desktop.openExternal(url);
    else window.open(url, '_blank', 'noopener');
  };

  const onCheckUpdate = async () => {
    setUpdate({ phase: 'checking' });
    setDownload({ phase: 'idle' });
    setUpdateOpen(true);
    const res = await fetchLatestRelease();
    if (res.status !== 'ok') {
      setUpdate({ phase: 'done', status: res.status, message: res.message });
      return;
    }
    const newer = isNewer(res.release.tag, APP_VERSION);
    setUpdate({
      phase: 'done',
      status: newer ? 'newer' : 'latest',
      release: res.release,
    });
  };

  const onDownload = async (asset) => {
    if (!asset) return;
    const desktop = window.starwayDesktop;
    if (!desktop?.downloadUpdate) {
      // 浏览器里没有主进程，直接打开发布页让用户自己下
      openLink(asset.url);
      return;
    }
    setDownload({ phase: 'downloading', percent: 0 });
    const res = await desktop.downloadUpdate({
      url: asset.url,
      filename: asset.name,
    });
    if (res?.ok) {
      setDownload({ phase: 'done', path: res.path, name: res.name });
      toast.success('已下载完成');
    } else {
      setDownload({ phase: 'failed', message: res?.message || '下载失败' });
    }
  };

  const onPreviewFull = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      const r = await previewFull({ ringtoneId });
      if (!r.soundOk && !r.notified) {
        toast.error('提醒不可用', '声音和系统通知都没能发出');
      } else {
        toast.success('已体验提醒', r.notified ? '含系统通知' : '系统通知不可用');
      }
    } catch (e) {
      toast.error('体验失败', e?.message);
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
              {FEEDBACK_MODES.filter((m) => m.id !== 'none').map((m) => (
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
          <Row title="体验" hint="铃声和系统通知都各来一遍">
            <Button variant="ghost" onClick={onPreviewFull} disabled={previewing}>
              {previewing ? '体验中…' : '体验'}
            </Button>
          </Row>
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

    const PLATFORM_LABEL = {
      win32: 'Windows',
      linux: 'Linux',
      darwin: 'macOS',
    };

    return (
      <div className="settings-about">
        <strong style={{ color: t.text, fontSize: 18 }}>{APP_NAME_FULL}</strong>
        <p style={{ color: t.textSecondary, margin: '6px 0 16px' }}>{APP_SLOGAN}</p>
        <Row title="版本" hint="点击查看本次更新内容">
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: t.primary,
              fontWeight: 700,
              fontSize: 'inherit',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {APP_VERSION}
          </button>
        </Row>
        <Row title="运行平台" hint="当前窗口所在系统">
          <span style={{ color: t.text }}>
            {PLATFORM_LABEL[platform] || platform}
          </span>
        </Row>
        <Row title="检查更新" hint="到 GitHub Releases 取最新版本">
          <Button
            variant="ghost"
            disabled={update.phase === 'checking'}
            onClick={onCheckUpdate}
          >
            {update.phase === 'checking' ? '检查中…' : '检查更新'}
          </Button>
        </Row>
      </div>
    );
  })();

  const release = update.release;
  const assets = release ? pickAssets(release.assets, platform) : null;
  const recommended = assets?.recommended || null;

  const updateModal = updateOpen ? (
    <div className="modal-mask" onClick={() => setUpdateOpen(false)}>
      <div
        className="modal"
        style={{ background: t.bgElevated, borderColor: t.border, color: t.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>检查更新</h2>
        <p className="muted" style={{ color: t.textSecondary, marginTop: 0 }}>
          当前版本 {APP_VERSION}
        </p>

        {update.phase === 'checking' ? (
          <p style={{ color: t.textSecondary, margin: '20px 0' }}>正在检查…</p>
        ) : null}

        {update.phase === 'done' && update.status === 'latest' ? (
          <p style={{ color: t.success, margin: '20px 0' }}>已是最新版本</p>
        ) : null}

        {update.phase === 'done' &&
        update.status !== 'latest' &&
        update.status !== 'newer' ? (
          <p style={{ color: t.textSecondary, margin: '20px 0' }}>
            {update.message}
          </p>
        ) : null}

        {update.phase === 'done' && update.status === 'newer' ? (
          <>
            <p style={{ color: t.text, margin: '16px 0 0' }}>
              有新版本 <strong>{release.name || release.tag}</strong>
            </p>
            {release.publishedAt ? (
              <p
                className="muted"
                style={{ color: t.muted, fontSize: 12, marginTop: 4 }}
              >
                发布于 {release.publishedAt.slice(0, 10)}
              </p>
            ) : null}

            <div className="row" style={{ marginTop: 16 }}>
              {recommended ? (
                <Button
                  variant="accent"
                  disabled={download.phase === 'downloading'}
                  onClick={() => onDownload(recommended)}
                >
                  {download.phase === 'downloading'
                    ? '下载中…'
                    : `下载安装包 ${formatSize(recommended.size)}`}
                </Button>
              ) : (
                <span style={{ color: t.textSecondary }}>
                  这个平台暂时没有现成安装包
                </span>
              )}
            </div>

            {recommended ? (
              <p
                className="muted"
                style={{ color: t.muted, fontSize: 12, marginTop: 6 }}
              >
                {recommended.name}
                {isElectron ? ' · 下载到「下载」文件夹' : ' · 在浏览器里打开'}
              </p>
            ) : null}

            {download.phase === 'downloading' ? (
              <div style={{ marginTop: 14 }}>
                <ProgressBar
                  current={download.percent || 0}
                  total={100}
                  percent={download.percent || 0}
                  fill={t.primary}
                  label={`下载中 ${formatSize(download.total)}`}
                />
              </div>
            ) : null}

            {download.phase === 'done' ? (
              <div className="row" style={{ marginTop: 14 }}>
                <span style={{ color: t.success }}>已下载 {download.name}</span>
                {window.starwayDesktop?.showItemInFolder ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      window.starwayDesktop.showItemInFolder(download.path)
                    }
                  >
                    打开所在文件夹
                  </Button>
                ) : null}
              </div>
            ) : null}

            {download.phase === 'failed' ? (
              <p style={{ color: t.danger, marginTop: 14 }}>
                {download.message}
              </p>
            ) : null}

            {assets?.others?.length ? (
              <div style={{ marginTop: 14 }}>
                <span style={{ color: t.muted, fontSize: 12 }}>其他下载：</span>
                {assets.others.map((a) => (
                  <button
                    key={a.url}
                    type="button"
                    className="chip"
                    style={{
                      marginLeft: 6,
                      borderColor: t.border,
                      color: t.textSecondary,
                      background: 'transparent',
                    }}
                    onClick={() => onDownload(a)}
                  >
                    {a.name} {formatSize(a.size)}
                  </button>
                ))}
              </div>
            ) : null}

            {release.notes ? (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{ color: t.textSecondary, fontSize: 12, marginBottom: 6 }}
                >
                  更新内容
                </div>
                <div
                  className="scroll-y"
                  style={{
                    maxHeight: 220,
                    whiteSpace: 'pre-wrap',
                    fontSize: 13,
                    lineHeight: 1.65,
                    color: t.textSecondary,
                  }}
                >
                  {release.notes}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <div
          className="row"
          style={{ marginTop: 20, justifyContent: 'flex-end' }}
        >
          <Button variant="ghost" onClick={() => setUpdateOpen(false)}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const notes = RELEASE_NOTES.find((n) => n.version === APP_VERSION) || RELEASE_NOTES[0];
  const notesModal = notesOpen && notes ? (
    <div className="modal-mask" onClick={() => setNotesOpen(false)}>
      <div
        className="modal"
        style={{ background: t.bgElevated, borderColor: t.border, color: t.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>本次更新</h2>
        <p className="muted" style={{ color: t.textSecondary, marginTop: 0 }}>
          v{notes.version}
        </p>
        <ul
          style={{
            color: t.textSecondary,
            fontSize: 13,
            lineHeight: 1.9,
            margin: '14px 0 0',
            paddingLeft: 18,
          }}
        >
          {notes.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setNotesOpen(false)}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  ) : null;

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
      {updateModal}
      {notesModal}
    </div>
  );
}
