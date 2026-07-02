import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Lock, Facebook, Twitter } from 'lucide-react';
import { login } from '../../../api/authentication/auth';
import './LoginForm.css';

export default function LoginForm({  }) {
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
      const res = await login({ username, password });
      
      // Nếu chọn Remember Me, lưu thông tin
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('username', username);
      } else {
        // Nếu không chọn, xóa thông tin đã lưu
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('username');
      }
      
      window.location.href = '/';
    } catch (err) {
      setError('Username or Password is not correct.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (platform) => {
    console.log(`${platform} login - Still developing`);
  };

  return (
    <div className="login-wrapper">
      <div className="login-background" />
      <div className="login-overlay" />

      <div className="login-content">
        <div className="login-header">
          <h1>Login</h1>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="input-group">
            <User className="input-icon" />
            <input
              type="text"
              placeholder="User name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              disabled={loading}
              required
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" />
            <input
              type="password"
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
              <span>Remember me</span>
            </label>
            <a href="#" className="forgot-password">
              Forgot Password?
            </a>
          </div>

          <button 
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div className="divider">
            <div className="divider-circle">or</div>
          </div>

          <div className="social-buttons">
            <button
              onClick={() => handleSocialLogin('Facebook')}
              className="social-button facebook"
              disabled={loading}
              type="button"
            >
              <Facebook className="social-icon" fill="currentColor" />
              <span>Facebook</span>
            </button>
            <button
              onClick={() => handleSocialLogin('Twitter')}
              className="social-button twitter"
              disabled={loading}
              type="button"
            >
              <Twitter className="social-icon" fill="currentColor" />
              <span>Twitter</span>
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p>
            Do not have an account?{' '}
          <Link to="/register" style={{ color: '#ffffff', fontWeight: '500', textDecoration: 'none' }}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}