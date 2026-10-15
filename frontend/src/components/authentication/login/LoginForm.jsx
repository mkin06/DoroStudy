import { useLanguage } from '../../../hooks/useLanguage';
import { translate as t } from '../../../lib/locale';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Lock, Facebook, Twitter } from 'lucide-react';
import { login } from '../../../api/authentication/auth';
import GoogleAuthButton from '../GoogleAuthButton';
import './LoginForm.css';

export default function LoginForm() {
  useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load remembered username khi component mount
  useEffect(() => {
    const remembered = localStorage.getItem('rememberMe') === 'true';
    const savedUsername = localStorage.getItem('username');
    
    if (remembered && savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedUsername = username.trim();
      await login({ username: normalizedUsername, password });
      
      // Nếu chọn Remember Me, lưu thông tin
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('username', normalizedUsername);
        // Giao mật khẩu cho password manager của trình duyệt/hệ điều hành thay vì
        // lưu dạng rõ trong localStorage. Chrome/Edge sẽ hỏi người dùng trước khi lưu.
        if ('PasswordCredential' in window && navigator.credentials?.store) {
          try {
            const credential = new window.PasswordCredential({
              id: normalizedUsername,
              name: normalizedUsername,
              password,
            });
            await navigator.credentials.store(credential);
          } catch {
            // Trình duyệt vẫn có thể lưu qua autocomplete chuẩn ở các input bên dưới.
          }
        }
      } else {
        // Nếu không chọn, xóa thông tin đã lưu
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('username');
      }
      
      window.location.href = '/';
    } catch (err) {
      setError(err.message || t("Tên đăng nhập/email hoặc mật khẩu không đúng."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-background" />
      <div className="login-overlay" />

      <div className="login-content">
        <div className="login-header">
          <h1>{t("Đăng nhập")}</h1>
        </div>

        <form className="login-form" onSubmit={handleLogin} autoComplete="on">
          {error && (
            <div className="error-message">
              {t(error)}
            </div>
          )}

          <div className="input-group">
            <User className="input-icon" />
            <input
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              placeholder={t("Tên đăng nhập hoặc email")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              disabled={loading}
              autoCapitalize="none"
              spellCheck="false"
              required
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" />
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              disabled={loading}
              required
            />
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span>{t("Ghi nhớ đăng nhập")}</span>
            </label>
          </div>

          <button 
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? t("Đang đăng nhập…") : t("Đăng nhập")}
          </button>

          <div className="divider">
            <div className="divider-circle">{t("hoặc")}</div>
          </div>

          <div className="social-buttons">
            <GoogleAuthButton 
              text="signin_with"
              disabled={loading}
              onError={(err) => setError(err)}
              onSuccess={() => {
                window.location.href = '/';
              }}
            />
          </div>
        </form>

        <div className="login-footer">
          <p>{t("Chưa có tài khoản?")}{' '}
          <Link to="/register" style={{ color: '#ffffff', fontWeight: '500', textDecoration: 'none' }}>{t("Đăng ký")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
