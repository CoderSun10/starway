import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import AuthNotice, { AuthSuccessMask } from '../components/AuthNotice';
import { Button, Card, Field, TextInput } from '../components/ui';
import { resetPassword, sendAuthCode } from '../services/api';
import { useTheme } from '../stores/themeStore';

export default function ForgotPasswordPage() {
  const t = useTheme();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
      const res = await sendAuthCode({ email: email.trim(), purpose: 'reset' });
      setWait(60);
      setNotice({ type: 'success', text: res.message || '如果该邮箱已注册，将收到验证码' });
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
      await resetPassword({
        email: email.trim(),
        code: code.trim(),
        password,
      });
      setNotice({ type: 'success', text: '密码已重置' });
      setDone(true);
      window.setTimeout(() => {
        nav('/login', { replace: true, state: { reset: true, email: email.trim() } });
      }, 720);
    } catch (err) {
      fail(err.message || '重置失败');
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-wrap">
        <Card className={`auth-card${shake ? ' shake' : ''}`}>
          {done ? <AuthSuccessMask title="密码已重置" sub="正在返回登录" /> : null}
          <h1 style={{ margin: '0 0 8px', color: t.text, fontSize: 22 }}>重置密码</h1>
          <p className="muted" style={{ color: t.textSecondary }}>
            向注册邮箱发送验证码，再设置新密码
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
            <Field label="邮箱验证码">
              <div className="auth-code-row">
                <TextInput
                  inputMode="numeric"
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
            <Field label="新密码">
              <TextInput
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位"
              />
            </Field>
            <Field label="确认新密码">
              <TextInput
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              disabled={submitting || done}
              className={submitting ? 'btn-busy' : ''}
              style={{ width: '100%' }}
            >
              {submitting ? '提交中…' : '重置密码'}
            </Button>
          </form>
          <div className="auth-links" style={{ color: t.textSecondary }}>
            <Link to="/login" style={{ color: t.primary }}>
              返回登录
            </Link>
          </div>
        </Card>
      </div>
    </AuthShell>
  );
}
