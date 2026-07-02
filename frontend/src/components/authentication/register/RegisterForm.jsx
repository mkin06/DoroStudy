import React, { useState } from 'react';
import '../register/RegisterForm.css';
import { register } from '../../../api/authentication/register';

export default function RegisterForm() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!name || !username || !password || !confirm) {
      setError('Please input information fully.');
      return;
    }
    
    if (password !== confirm) {
      setError('Confirm password does not match.');
      return;
    }
    
    try {
      await register({ name, username, password });
      setSuccess('Registration successful! Please log in.');
      setName('');
      setUsername('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message || 'Registration failed. The username may already exist.');
    }
  };

  return (
    <div className="register-wrapper">
      <div className="register-background"></div>
      <div className="register-overlay"></div>
      
      <div className="register-content">
        {/* Header */}
        <div className="register-header">
          <h1>Register</h1>
        </div>

        {/* Registration Form */}
        <form className="register-form" onSubmit={handleRegister}>
          {/* Error Message */}
          {error && <div className="register-error-message">{error}</div>}
          
          {/* Success Message */}
          {success && <div className="register-success-message">{success}</div>}

          {/* Full Name Input */}
          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="register-input-field"
              required
            />
          </div>

          {/* Username Input */}
          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <input
              type="text"
              placeholder="User name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="register-input-field"
              required
            />
          </div>

          {/* Password Input */}
          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="register-input-field"
              required
            />
          </div>

          {/* Confirm Password Input */}
          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="register-input-field"
              required
            />
          </div>

          {/* Register Button */}
          <button type="submit" className="register-button">
            Register
          </button>

          {/* Divider */}
          <div className="register-divider">
            <div className="register-divider-circle">OR</div>
          </div>

          {/* Social Login Buttons */}
          <div className="register-social-buttons">
            <button type="button" className="register-social-button facebook" disabled>
              <svg className="register-social-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
            <button type="button" className="register-social-button twitter" disabled>
              <svg className="register-social-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
              Twitter
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="register-footer">
          <p>Already have an account? <a href="/login">Log in</a></p>
        </div>
      </div>
    </div>
  );
}