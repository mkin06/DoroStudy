import React from 'react';
import { Link } from 'react-router-dom';
import RegisterForm from '../components/authentication/register/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <RegisterForm />
      <p style={{ textAlign: 'center', marginTop: 16 }}>
        Haven't got an account?{' '}
        <Link to="/login" style={{ color: '#1976d2' }}>
          Login
        </Link>
      </p>
    </div>
  );
}