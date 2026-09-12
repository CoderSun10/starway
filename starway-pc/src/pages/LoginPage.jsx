import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import AuthNotice, { AuthSuccessMask } from '../components/AuthNotice';
import { Button, Card, Field, TextInput } from '../components/ui';
import { APP_NAME, APP_SLOGAN } from '../constants/brand';
import { login } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../stores/themeStore';
import appIcon from '../assets/icon.png';

export default function LoginPage() {
  const t = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState(loc.state?.email || '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState(() => {
    if (loc.state?.registered) return { type: 'success', text: '注册成功，请登录' };
    if (loc.state?.reset) return { type: 'success', text: '密码已重置，请登录' };
    return null;
  });

  const fail = (text) => {
    setNotice({ type: 'error', text });
    setShake(true);
    window.setTimeout(() => setShake(false), 520);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      fail('请输入邮箱和密码');
      return;
    }
    setSubmitting(true);
    try {
      const data = await login({ email: email.trim(), password });
      setSession({ user: data.user, accessToken: data.accessToken });
      setNotice({ type: 'success', text: '登录成功' });
      setDone(true);
      const to = loc.state?.from?.pathname || '/';
      window.setTimeout(() => nav(to, { replace: true }), 720);
    } catch (err) {
      fail(err.message || '登录失败');
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-wrap">
        <Card className={`auth-card${shake ? ' shake' : ''}`}>
          {done ? <AuthSuccessMask title="登录成功" sub="正在进入星程" /> : null}
          <div className="auth-brand">
            <img src={appIcon} alt="" className="auth-logo" />
            <div>
              <h1 style={{ margin: 0, color: t.text }}>{APP_NAME}</h1>
              <p className="muted" style={{ color: t.textSecondary, margin: '4px 0 0' }}>
                {APP_SLOGAN}
              </p>
            </div>
          </div>
          <h2 style={{ margin: '8px 0 4px', color: t.text, fontSize: 20 }}>登录</h2>
          <p className="muted" style={{ color: t.textSecondary, marginTop: 0 }}>
            用邮箱和密码进入你的时间与用度
          </p>
          <AuthNotice key={notice?.text} type={notice?.type}>
            {notice?.text}
          </AuthNotice>
          <form onSubmit={onSubmit}>
            <Field label="邮箱">
              <TextInput
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="密码">
              <TextInput
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Button
              type="submit"
              disabled={submitting || done}
              className={submitting ? 'btn-busy' : ''}
              style={{ width: '100%' }}
            >
              {submitting ? '登录中…' : '登录'}
            </Button>
          </form>
          <div className="auth-links" style={{ color: t.textSecondary }}>
            <Link to="/forgot" style={{ color: t.primary }}>
              忘记密码
            </Link>
            <span>还没有账号？</span>
            <Link to="/register" style={{ color: t.primary }}>
              注册
            </Link>
          </div>
        </Card>
      </div>
    </AuthShell>
  );
}
