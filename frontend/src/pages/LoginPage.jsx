import React from 'react';
import LoginForm from '../components/authentication/login/LoginForm';
import LanguageSwitcher from '../components/language/LanguageSwitcher';

export default function LoginPage() {
  return (
    <div className="auth-page"><LanguageSwitcher className="auth-language-switcher" /><LoginForm /></div>
  );
}
