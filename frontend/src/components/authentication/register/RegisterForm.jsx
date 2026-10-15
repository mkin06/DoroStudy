import { useLanguage } from '../../../hooks/useLanguage';
import { translate as t } from '../../../lib/locale';
import React, { useState } from 'react';
import './RegisterForm.css';
import { register } from '../../../api/authentication/register';
import GoogleAuthButton from '../GoogleAuthButton';

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,60}$/;

export default function RegisterForm() {
  useLanguage();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const name = form.name.trim();
    const username = form.username.trim().toLowerCase();
    const email = form.email.trim().toLowerCase();

    if (!name || !username || !email || !form.password || !form.confirm) {
      setError(t("Vui lòng nhập đầy đủ thông tin."));
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      setError(t("Tên đăng nhập cần 3–60 ký tự và chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang."));
      return;
    }
    if (form.password.length < 8 || form.password.length > 64) {
      setError(t("Mật khẩu phải có từ 8 đến 64 ký tự."));
      return;
    }
    if (form.password !== form.confirm) {
      setError(t("Mật khẩu nhập lại chưa khớp."));
      return;
    }

    setLoading(true);
    try {
      await register({ name, username, email, password: form.password });
      setSuccess(t("Đăng ký thành công. Bạn có thể đăng nhập ngay."));
      setForm({ name: '', username: '', email: '', password: '', confirm: '' });
    } catch (err) {
      setError(err.message || t("Không thể đăng ký tài khoản. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-wrapper">
      <div className="register-background" />
      <div className="register-overlay" />

      <div className="register-content">
        <div className="register-header"><h1>{t("Đăng ký")}</h1></div>

        <form className="register-form" onSubmit={handleRegister} autoComplete="on">
          {error && <div className="register-error-message" role="alert">{t(error)}</div>}
          {success && <div className="register-success-message" role="status">{t(success)}</div>}

          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <input type="text" name="name" autoComplete="name" placeholder={t("Họ và tên")}
              value={form.name} onChange={update('name')} className="register-input-field"
              maxLength={120} disabled={loading} required />
          </div>

          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <input type="email" name="email" autoComplete="email" inputMode="email"
              autoCapitalize="none" spellCheck="false" placeholder={t("Địa chỉ email")}
              value={form.email} onChange={update('email')} className="register-input-field"
              maxLength={255} disabled={loading} required />
          </div>

          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <input type="text" name="username" autoComplete="username" autoCapitalize="none"
              spellCheck="false" placeholder={t("Tên đăng nhập")}
              value={form.username} onChange={update('username')} className="register-input-field"
              minLength={3} maxLength={60} pattern="[A-Za-z0-9._-]+" disabled={loading} required />
          </div>

          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <input type="password" name="new-password" autoComplete="new-password"
              placeholder={t("Mật khẩu (8–64 ký tự)")} value={form.password}
              onChange={update('password')} className="register-input-field"
              minLength={8} maxLength={64} disabled={loading} required />
          </div>

          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <input type="password" name="confirm-password" autoComplete="new-password"
              placeholder={t("Nhập lại mật khẩu")} value={form.confirm}
              onChange={update('confirm')} className="register-input-field"
              minLength={8} maxLength={64} disabled={loading} required />
          </div>

          <button type="submit" className="register-button" disabled={loading}>
            {loading ? t("Đang tạo tài khoản…") : t("Tạo tài khoản")}
          </button>

          <div className="register-divider"><div className="register-divider-circle">{t("hoặc")}</div></div>
          <div className="register-social-buttons">
            <GoogleAuthButton text="signup_with" disabled={loading}
              onError={setError} onSuccess={() => { window.location.href = '/'; }} />
          </div>
        </form>

        <div className="register-footer">
          <p>{t("Đã có tài khoản?")}<a href="/login">{t("Đăng nhập")}</a></p>
        </div>
      </div>
    </div>
  );
}
