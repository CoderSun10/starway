import { useEffect, useState } from 'react';
import { useTheme, useThemeStore } from '../stores/themeStore';
import { useSettingsStore } from '../stores/settingsStore';
import { THEME_LIST } from '../constants/themes';
import { getBaseURL, healthCheck, setBaseURL } from '../services/api';
import { APP_NAME_FULL, APP_SLOGAN } from '../constants/brand';
import {
  FEEDBACK_MODES,
  RINGTONE_PRESETS,
  previewFeedback,
} from '../utils/feedback';
import {
  Button,
  Card,
  Chip,
  Field,
  PageHeader,
  TextInput,
} from '../components/ui';
import { toast } from '../stores/toastStore';

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
  const hydrateDesktop = useSettingsStore((s) => s.hydrateDesktop);

  const [url, setUrl] = useState(getBaseURL());
  const [testing, setTesting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [platform, setPlatform] = useState('web');
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    hydrateDesktop();
    if (window.ningshiDesktop?.getInfo) {
      setIsElectron(true);
      window.ningshiDesktop.getInfo().then((info) => {
        setPlatform(info.platform || 'electron');
      });
    }
  }, [hydrateDesktop]);

  const onSave = () => {
    const v = url.trim().replace(/\/$/, '');
    if (!/^https?:\/\//.test(v)) {
      toast.error('请输入合法 http(s) 地址');
      return;
    }
    setBaseURL(v);
    setUrl(v);
    toast.success('API 地址已保存');
  };

  const onTest = async () => {
    setTesting(true);
    try {
      setBaseURL(url.trim().replace(/\/$/, ''));
      const res = await healthCheck();
      toast.success('连接成功', res.message || 'API OK');
    } catch (e) {
      toast.error('连接失败', e.message);
    } finally {
      setTesting(false);
    }
  };

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

  return (
    <div>
      <PageHeader title="设置" sub="主题、提醒、托盘与后端" />

      <Card>
        <h3 style={{ margin: '0 0 12px', color: t.text }}>主题</h3>
        <div className="chip-row">
          {THEME_LIST.map((item) => (
            <Chip
              key={item.id}
              active={themeId === item.id}
              onClick={() => setThemeId(item.id)}
            >
              {item.name}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 8px', color: t.text }}>结束提醒</h3>
        <p className="muted" style={{ color: t.textSecondary, marginTop: 0 }}>
          计时结束时播放本地合成提示音，并可选系统通知（不依赖外网）
        </p>
        <div className="label" style={{ color: t.textSecondary }}>
          提醒方式
        </div>
        <div className="chip-row" style={{ marginBottom: 12 }}>
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
        {(feedbackMode === 'both' || feedbackMode === 'sound') && (
          <>
            <div className="label" style={{ color: t.textSecondary }}>
              铃声
            </div>
            <div className="chip-row" style={{ marginBottom: 12 }}>
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
          </>
        )}
        {feedbackMode !== 'none' ? (
          <Button variant="ghost" onClick={onPreview} disabled={previewing}>
            {previewing ? '试听中…' : '试一下当前效果'}
          </Button>
        ) : null}
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 8px', color: t.text }}>桌面行为</h3>
        {!isElectron ? (
          <p className="muted" style={{ color: t.muted }}>
            当前为浏览器预览；托盘 / 开机启动在 Electron 窗口中生效。
          </p>
        ) : null}
        <label
          className="row"
          style={{ marginBottom: 12, cursor: 'pointer', color: t.text }}
        >
          <input
            type="checkbox"
            checked={minimizeToTray}
            onChange={(e) => setMinimizeToTray(e.target.checked)}
          />
          <span>关闭窗口时最小化到系统托盘（不退出）</span>
        </label>
        <label className="row" style={{ cursor: 'pointer', color: t.text }}>
          <input
            type="checkbox"
            checked={openAtLogin}
            onChange={(e) => setOpenAtLogin(e.target.checked)}
          />
          <span>开机自动启动凝时</span>
        </label>
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 8px', color: t.text }}>后端 API</h3>
        <p className="muted" style={{ color: t.textSecondary, marginTop: 0 }}>
          默认本机 Docker：http://127.0.0.1:3001
        </p>
        <Field label="地址">
          <TextInput value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <div className="row">
          <Button variant="outline" onClick={onSave}>
            保存
          </Button>
          <Button variant="accent" onClick={onTest} disabled={testing}>
            {testing ? '测试中…' : '测试连接'}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 8px', color: t.text }}>关于</h3>
        <p style={{ color: t.text, margin: 0, fontWeight: 700 }}>{APP_NAME_FULL}</p>
        <p className="muted" style={{ color: t.textSecondary }}>
          {APP_SLOGAN}
        </p>
        <p className="muted" style={{ color: t.muted, lineHeight: 1.7 }}>
          版本 1.0.0 · Electron 桌面端
          <br />
          运行平台：{platform}
          <br />
          工程目录：ningshi-pc（与手机 App 源码独立）
        </p>
      </Card>
    </div>
  );
}
