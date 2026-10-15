import React from 'react';
import RegisterForm from '../components/authentication/register/RegisterForm';
import LanguageSwitcher from '../components/language/LanguageSwitcher';

export default function RegisterPage() {
  return (
    <div className="auth-page"><LanguageSwitcher className="auth-language-switcher" /><RegisterForm /></div>
  );
}
