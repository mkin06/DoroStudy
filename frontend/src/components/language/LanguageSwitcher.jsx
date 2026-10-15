import { Languages } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import './LanguageSwitcher.css';

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage } = useLanguage();
  return <div className={`language-switcher ${className}`} role="group" aria-label="Ngôn ngữ / Language">
    <Languages size={16} aria-hidden="true" />
    <button type="button" lang="vi" aria-label="Tiếng Việt" aria-pressed={language === 'vi'} onClick={() => setLanguage('vi')}>VI</button>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
  </div>;
}
