import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import AuthNotice, { AuthSuccessMask } from '../components/AuthNotice';
import { Button, Card, Field, TextInput } from '../components/ui';
import { APP_NAME } from '../constants/brand';
import { register, sendAuthCode } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../stores/themeStore';
import appIcon from '../assets/icon.png';

export default function RegisterPage() {
  const t = useTheme();
  const nav = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wait, setWait] = useState(0);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const fail = (text) => {
    setNotice({ type: 'error', text });
    setShake(true);
    window.setTimeout(() => setShake(false), 520);
  };

  const onSend = async () => {
    if (!email.trim()) {
      fail('请先填写邮箱');
      return;
    }
    setSending(true);
    try {
      const res = await sendAuthCode({ email: email.trim(), purpose: 'register' });
      setWait(60);
      setNotice({ type: 'success', text: res.message || '验证码已发送，请查收邮箱' });
    } catch (err) {
      fail(err.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      fail('两次密码不一致');
      return;
    }
    if (password.length < 8) {
      fail('密码至少 8 位');
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      fail('请输入 6 位邮箱验证码');
      return;
    }
    setSubmitting(true);
    try {
      const data = await register({
        email: email.trim(),
        password,
        code: code.trim(),
      });
      setSession({ user: data.user, accessToken: data.accessToken });
      setNotice({ type: 'success', text: '注册成功' });
      setDone(true);
      window.setTimeout(() => nav('/', { replace: true }), 720);
    } catch (err) {
      fail(err.message || '注册失败');
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-wrap">
        <Card className={`auth-card${shake ? ' shake' : ''}`}>
          {done ? <AuthSuccessMask title="注册成功" sub="正在进入星程" /> : null}
          <div className="auth-brand">
            <img src={appIcon} alt="" className="auth-logo" />
            <h1 style={{ margin: 0, color: t.text }}>{APP_NAME} · 注册</h1>
          </div>
          <p className="muted" style={{ color: t.textSecondary }}>
            先验证邮箱，再创建属于你的数据空间
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位"
              />
            </Field>
            <Field label="确认密码">
              <TextInput
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再输一次"
              />
            </Field>
            <Field label="邮箱验证码">
              <div className="auth-code-row">
                <TextInput
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6 位数字"
                  maxLength={6}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={sending || wait > 0 || done}
                  onClick={onSend}
                >
                  {wait > 0 ? `${wait}s` : sending ? '发送中…' : '发送验证码'}
                </Button>
              </div>
            </Field>
            <Button
              type="submit"
              disabled={submitting || done}
              className={submitting ? 'btn-busy' : ''}
              style={{ width: '100%' }}
            >
              {submitting ? '注册中…' : '验证并注册'}
            </Button>
          </form>
          <div className="auth-links" style={{ color: t.textSecondary }}>
            <span>已有账号？</span>
            <Link to="/login" style={{ color: t.primary }}>
              去登录
            </Link>
          </div>
        </Card>
      </div>
    </AuthShell>
  );
}
