import React, { useState } from 'react';
import '../register/RegisterForm.css';
import { register } from '../../../api/authentication/register';
import GoogleAuthButton from '../GoogleAuthButton';

export default function RegisterForm() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!name || !username || !email || !password || !confirm) {
      setError('Please input all required information.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    
    if (password !== confirm) {
      setError('Confirm password does not match.');
      return;
    }
    
    try {
      await register({ name, username, email, password });
      setSuccess('Registration successful! Please log in.');
      setName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message || 'Registration failed. The username or email may already exist.');
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

          {/* Email Input */}
          <div className="register-input-group">
            <svg className="register-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          {/* Social / Google Sign-Up */}
          <div className="register-social-buttons">
            <GoogleAuthButton 
              text="signup_with"
              onError={(err) => setError(err)}
              onSuccess={() => {
                window.location.href = '/';
              }}
            />
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