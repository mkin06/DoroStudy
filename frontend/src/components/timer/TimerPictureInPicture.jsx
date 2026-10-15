import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SkipForward } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import StudyBackground from './StudyBackground';
import backgroundStyles from './StudyBackground.css?inline';
import pipStyles from './TimerPictureInPicture.css?inline';

export default function TimerPictureInPicture({ pipWindow, scene, minutes, seconds, isRunning, isBreak, onToggle, onSkip }) {
  const { language, t } = useLanguage();
  useEffect(() => {
    pipWindow.document.documentElement.lang = language;
    pipWindow.document.title = 'DoroStudy';
  }, [pipWindow, language]);

  return createPortal(<>
    <style>{backgroundStyles + pipStyles}</style>
    <div className="pip-container">
      <StudyBackground scene={scene} />
      <main className="pip-content" aria-label={t('Đồng hồ thu nhỏ')}>
        <span className="pip-mode">{t(isBreak ? 'Giờ nghỉ' : 'Tập trung')}</span>
        <div id="pip-timer" className="pip-timer" role="timer">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</div>
        <div className="pip-controls">
          <button id="pip-play-pause" type="button" className="pip-btn" onClick={onToggle}
            aria-label={t(isRunning ? 'Tạm dừng đồng hồ' : 'Bắt đầu đồng hồ')}>
            {t(isRunning ? 'Tạm dừng' : 'Bắt đầu')}
          </button>
          <button id="pip-skip" type="button" className="pip-icon-btn" onClick={onSkip}
            aria-label={t(isBreak ? 'Bỏ qua giờ nghỉ' : 'Chuyển sang giờ nghỉ')}
            title={t(isBreak ? 'Bỏ qua giờ nghỉ' : 'Chuyển sang giờ nghỉ')}>
            <SkipForward size={20} aria-hidden="true" />
          </button>
        </div>
      </main>
    </div>
  </>, pipWindow.document.body);
}
