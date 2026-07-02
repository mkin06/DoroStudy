import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../components/authentication/login/LoginForm';

export default function LoginPage() {
  return (
    <div className="auth-page">
      <LoginForm />
      <p style={{ textAlign: 'center', marginTop: 16 }}>
        Haven't got an account?{' '}
        <Link to="/register" style={{ color: '#1976d2' }}>
          Register
        </Link>
      </p>
    </div>
  );
}