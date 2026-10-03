import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './PomodoroTimer.css';
import useTimer from '../../hooks/userTimer';
import backgroundImage from '../../assets/background.jpg';
import SettingsModal, { PRESETS } from './SettingsModal';
import { logout, me } from '../../api/authentication/auth';
import ProfilePage from '../profile/UserProfile';
import { studySessionAPI } from '../../api/studySession';
import { useToast } from '../../contexts/ToastContext';
import NotesPanel from '../notes/NotesPanel';
import MusicModal from './MusicModal';
import BackgroundModal from './BackgroundModal';
import ReflectionModal from '../reflection/ReflectionModal';
import FocusProfilePanel from '../insights/FocusProfilePanel';
import NextSessionCard from '../coach/NextSessionCard';
import NudgeBanner from '../coach/NudgeBanner';

// SVG Icon imports
import upgradeIcon from '../../assets/user-menu/gift.svg';
import profileIcon from '../../assets/user-menu/profile.svg';
import roomIcon from '../../assets/user-menu/group.svg';
import settingsIcon from '../../assets/user-menu/setting.svg';
import friendIcon from '../../assets/user-menu/friend.svg';
import extensionIcon from '../../assets/user-menu/extension.svg';
import ourApp from '../../assets/user-menu/app.svg';
import logoutIcon from '../../assets/user-menu/logout.svg';
import weatherIcon from '../../assets/ground/cloud.svg';
import musicIcon from '../../assets/ground/music.svg';
import backgroundIcon from '../../assets/ground/picture.svg';
import notesIcon from '../../assets/ground/note.svg';
import chattingIcon from '../../assets/ground/chatting.svg';
import findUser from '../../assets/ground/finduser.svg';
import focusLightning from '../../assets/ground/lightning.svg';
import clockIcon from '../../assets/ground/clock.svg';
import fireIcon from '../../assets/ground/fire.svg';
import stopwatchIcon from '../../assets/ground/stopwatch.svg';
import chartIcon from '../../assets/ground/chart.svg';
import bellIcon from '../../assets/ground/bell.svg';
import targetIcon from '../../assets/ground/target.svg';
import settingClockIcon from '../../assets/user-menu/settingClock.svg';

const getYouTubeId = (url) => {
  if (!url) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
};

// ========== STATIC CONFIGS ==========
const MENU_ITEMS = [
  { id: 'upgrade', icon: upgradeIcon, text: 'Upgrade to Plus', arrow: true, type: 'svg' },
  { id: 'profile', icon: profileIcon, text: 'Public profile', arrow: true, type: 'svg' },
  { id: 'focusdna', icon: '🧬', text: 'Focus DNA', arrow: true, type: 'emoji' },
  { id: 'room', icon: roomIcon, text: 'Find study room', arrow: true, type: 'svg' },
  { id: 'settings', icon: settingsIcon, text: 'App settings', arrow: true, type: 'svg' },
  { id: 'friends', icon: friendIcon, text: 'Manage friends', arrow: true, type: 'svg' },
];

const EXTERNAL_ITEMS = [
  { id: 'discord', icon: '💬', text: 'Discord', external: true, type: 'emoji' },
  { id: 'extension', icon: extensionIcon, text: 'Chrome extension', external: true, type: 'svg' },
  { id: 'notion', icon: '📝', text: 'Notion pomodoro timer', external: true, type: 'emoji' },
];

const FOOTER_ITEMS = [
  { id: 'apps', icon: ourApp, text: 'Our apps', arrow: true, type: 'svg' },
  { id: 'logout', icon: logoutIcon, text: 'Logout', external: true, type: 'svg' },
];

const PRESET_NAMES = ['Pomodoro', 'Short Break', 'Long Break'];
const DEFAULT_PRESET_TIMES = [PRESETS[0].focus, PRESETS[0].short, PRESETS[0].long];

const FOOTER_BUTTONS_LEFT = [
  { id: 'cloud', icon: weatherIcon, label: 'Cloud' },
  { id: 'music', icon: musicIcon, label: 'Music' },
  { id: 'background', icon: backgroundIcon, label: 'Background' },
  { id: 'notes', icon: notesIcon, label: 'Notes' },
];

const FOOTER_BUTTONS_RIGHT = [
  { id: 'user', icon: findUser, label: 'User' },
  { id: 'chat', icon: chattingIcon, label: 'Chat' },
  { id: 'deepfocus', icon: focusLightning, label: 'Deep Focus' },
  { id: 'clock', icon: clockIcon, label: 'Clock' },
];

// ========== MEMOIZED COMPONENTS ==========
const IconRenderer = React.memo(({ icon, type }) => {
  if (type === 'svg') {
    return (
      <img
        src={icon}
        alt=""
        loading="lazy"
        className="icon-svg"
        width="20"
        height="20"
      />
    );
  }
  return <span className="emoji-icon">{icon}</span>;
});
IconRenderer.displayName = 'IconRenderer';

const UserMenuItemComponent = React.memo(({ item, onItemClick }) => {
  const handleClick = useCallback(() => {
    onItemClick(item.id);
  }, [item.id, onItemClick]);

  return (
    <button className="user-dropdown-item" onClick={handleClick}>
      <span className="item-icon">
        <IconRenderer icon={item.icon} type={item.type} />
      </span>
      <span className="item-text">{item.text}</span>
      <span className={item.arrow ? 'item-arrow' : 'item-external'}>
        {item.arrow ? '›' : '↗'}
      </span>
    </button>
  );
});
UserMenuItemComponent.displayName = 'UserMenuItemComponent';

const UserMenuSection = React.memo(({ items, isLast, onItemClick }) => {
  return (
    <>
      <div className="user-dropdown-items">
        {items.map(item => (
          <UserMenuItemComponent
            key={item.id}
            item={item}
            onItemClick={onItemClick}
          />
        ))}
      </div>
      {!isLast && <div className="user-dropdown-divider" />}
    </>
  );
});
UserMenuSection.displayName = 'UserMenuSection';

const PresetDots = React.memo(({ currentPreset, onPresetChange }) => {
  return (
    <div className="preset-dots">
      {PRESET_NAMES.map((name, index) => (
        <button
          key={index}
          className={`preset-dot ${currentPreset === index ? 'active' : ''}`}
          onClick={() => onPresetChange(index)}
          aria-label={`${name} preset`}
          title={name}
        />
      ))}
    </div>
  );
});
PresetDots.displayName = 'PresetDots';

const FooterButtonsGroup = React.memo(({ buttons, direction, onButtonClick }) => {
  return (
    <div className={`footer-${direction}`}>
      {buttons.map(btn => {
        const isSvg = typeof btn.icon === 'string' && (btn.icon.includes('.svg') || btn.icon.startsWith('data:'));
        return (
          <button
            key={btn.id}
            className="footer-btn"
            aria-label={btn.label}
            title={btn.label}
            onClick={() => onButtonClick?.(btn.id)}
          >
            {isSvg ? (
              <img
                src={btn.icon}
                alt={btn.label}
                className="footer-btn-icon"
                loading="lazy"
              />
            ) : (
              btn.icon
            )}
          </button>
        );
      })}
    </div>
  );
});
FooterButtonsGroup.displayName = 'FooterButtonsGroup';

const UserDropdownHeader = React.memo(({ user, onClose }) => {
  const displayName = user ? (user.name || user.username) : 'Guest User';
  const subtitle = user 
    ? (user.email || (user.status === 'ACTIVE' ? 'Active Member' : 'Member')) 
    : 'Guest Account';

  return (
    <div className="user-dropdown-header">
      <div style={{ maxWidth: '210px', overflow: 'hidden' }}>
        <div className="user-dropdown-title" title={displayName} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {displayName}
        </div>
        <div className="user-dropdown-subtitle" title={subtitle} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {subtitle}
        </div>
      </div>
      <button
        className="user-dropdown-close"
        onClick={onClose}
        aria-label="Close menu"
      >
        ✕
      </button>
    </div>
  );
});
UserDropdownHeader.displayName = 'UserDropdownHeader';


// ========== MAIN COMPONENT ==========
export default function PomodoroTimer() {
  const navigate = useNavigate();
  const toast = useToast();
  const [timerMode, setTimerMode] = useState('focus'); // 'focus' | 'stopwatch'
  const [activePreset, setActivePreset] = useState(PRESETS[0]);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [isDeepFocus, setIsDeepFocus] = useState(Boolean(document.fullscreenElement));

  const {
    hours,
    minutes,
    seconds,
    totalMinutes,
    totalSeconds,
    isRunning,
    toggleTimer,
    resetTimer,
    setTime
  } = useTimer(DEFAULT_PRESET_TIMES[0], timerMode === 'stopwatch');

  // States
  const [mode, setMode] = useState('pomodoro');
  const [showSettings, setShowSettings] = useState(false);
  const [task, setTask] = useState('');
  const [currentPreset, setCurrentPreset] = useState(0);
  const [presetTimes, setPresetTimes] = useState(DEFAULT_PRESET_TIMES);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isPiPMode, setIsPiPMode] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicVideoId, setMusicVideoId] = useState('jfKfPfyJRdk'); // default lofi girl stream
  const [showBackground, setShowBackground] = useState(false);
  // sessionId của phiên vừa lưu — có giá trị thì hiện popup reflection
  const [reflectionSessionId, setReflectionSessionId] = useState(null);
  const [showFocusProfile, setShowFocusProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch logged in user profile
  useEffect(() => {
    let isMounted = true;
    me()
      .then((data) => {
        if (isMounted && data) {
          setCurrentUser(data);
        }
      })
      .catch((err) => {
        console.warn('User not authenticated, running in guest mode:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const userInitials = useMemo(() => {
    if (!currentUser) return 'G';
    const nameToUse = currentUser.name || currentUser.username || '';
    if (!nameToUse) return 'U';
    const parts = nameToUse.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return nameToUse.slice(0, 2).toUpperCase();
  }, [currentUser]);

  const footerMenuItems = useMemo(() => {
    if (!currentUser) {
      return [
        { id: 'apps', icon: ourApp, text: 'Our apps', arrow: true, type: 'svg' },
        { id: 'login', icon: logoutIcon, text: 'Log in / Register', arrow: true, type: 'svg' },
      ];
    }
    return [
      { id: 'apps', icon: ourApp, text: 'Our apps', arrow: true, type: 'svg' },
      { id: 'logout', icon: logoutIcon, text: 'Logout', external: true, type: 'svg' },
    ];
  }, [currentUser]);

  // Đổi giá trị để buộc thẻ Focus Coach tải lại kế hoạch — sau mỗi phiên, dữ liệu mới đã
  // vào hồ sơ nên kế hoạch cũ không còn đúng nữa.
  const [coachRefreshKey, setCoachRefreshKey] = useState(0);
  // Chốt chặn lưu trùng: effect auto-save chạy lại mỗi khi render trong lúc timer ở 00:00
  // (đổi task, StrictMode double-invoke...) nên phải nhớ đã lưu phiên nào chưa.
  const savingSessionRef = useRef(false);
  // Thời điểm user bấm Start — gửi lên backend để Meta-Learning biết đúng khung giờ học
  const sessionStartedAtRef = useRef(null);

  const [scene, setScene] = useState({
    type: 'image',
    url: backgroundImage,
    thumbnail: backgroundImage,
    id: 'default',
    opacity: 0.3,
    weather: 'clear',
  });
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    setVideoError(false);
    setVideoLoaded(false);
  }, [scene.url]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsDeepFocus(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleDeepFocus = useCallback(() => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsDeepFocus(true);
      toast.success('⚡ Deep Focus: Đã bật toàn màn hình');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsDeepFocus(false);
      toast.info('Đã thoát Deep Focus');
    }
  }, [toast]);

  // Refs
  const userMenuRef = useRef(null);
  const [showProfile, setShowProfile] = useState(false);
  const videoRef = useRef(null);
  const pipWindowRef = useRef(null);

  // ========== CLICK OUTSIDE HANDLER ==========
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);


  // ========== OPTIMIZED HANDLERS (useCallback) ==========
  
  // ========== PICTURE-IN-PICTURE SETUP ==========
  useEffect(() => {
    return () => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      const pipDoc = pipWindowRef.current.document;
      const timerElement = pipDoc.getElementById('pip-timer');
      if (timerElement) {
        const displayTime = (timerMode === 'stopwatch' && hours > 0)
          ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        timerElement.textContent = displayTime;
      }
      const playPauseBtn = pipDoc.getElementById('pip-play-pause');
      if (playPauseBtn) {
        playPauseBtn.textContent = isRunning ? 'Pause' : 'Start';
        const newBtn = playPauseBtn.cloneNode(true);
        playPauseBtn.parentNode.replaceChild(newBtn, playPauseBtn);
        newBtn.addEventListener('click', () => {
          toggleTimer();
        });
      }
    }
  }, [hours, minutes, seconds, isRunning, timerMode, toggleTimer]);

  // Người dùng bấm vào thông báo đẩy: service worker mở app kèm kế hoạch trên URL.
  // Áp luôn rồi dọn URL — để lại query string thì F5 một cái là timer bị đặt lại lần nữa.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const minutes = Number(params.get('nudgeMinutes'));
    const subject = params.get('nudgeSubject');
    if (!minutes && !subject) return;

    if (minutes > 0) {
      setPresetTimes((prev) => [minutes, prev[1], prev[2]]);
      setTime?.(minutes);
      setCurrentPreset(0);
    }
    if (subject) {
      setTask(subject);
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, [setTime]);

  // Ghi lại thời điểm bắt đầu phiên Pomodoro để gửi kèm khi lưu
  useEffect(() => {
    if (isRunning && currentPreset === 0 && sessionStartedAtRef.current === null) {
      sessionStartedAtRef.current = new Date().toISOString();
    }
  }, [isRunning, currentPreset]);



  // ========== HANDLERS ==========
  const handleToggleUserMenu = useCallback(() => {
    setShowUserMenu(prev => !prev);
  }, []);

  const handleCloseUserMenu = useCallback(() => {
    setShowUserMenu(false);
  }, []);

  const handleOpenProfile = useCallback(() => {
    setShowProfile(true);
    setShowUserMenu(false);
  }, []);
const handleMenuItemClick = useCallback(async (itemId) => {
  if (itemId === 'profile') {
    setShowProfile(true);
    setShowUserMenu(false);
    return;
  }

  if (itemId === 'focusdna') {
    setShowFocusProfile(true);
    setShowUserMenu(false);
    return;
  }

  if (itemId === 'login') {
    navigate('/login');
    setShowUserMenu(false);
    return;
  }

  if (itemId === 'logout') {
    try {
      await logout();
      setCurrentUser(null);
      navigate('/login');
    } catch (error) {
      toast.error(error.message || 'Logout failed.');
    }
    setShowUserMenu(false);
    return;
  }

  console.log('Menu item clicked:', itemId);
  setShowUserMenu(false);
}, [navigate]);


  const handleTimerModeChange = useCallback((newMode) => {
    if (newMode === timerMode) return;
    setTimerMode(newMode);
    if (newMode === 'focus') {
      setCurrentPreset(0);
      if (setTime) {
        setTime(presetTimes[0]);
      }
      toast.info('Switched to Focus Timer (Countdown)');
    } else {
      toast.info('Switched to Stopwatch mode');
    }
  }, [timerMode, presetTimes, setTime, toast]);

  const handleSaveStopwatchSession = useCallback(async () => {
    if (totalSeconds < 60) {
      toast.info('Stopwatch session must be at least 1 minute to save.');
      return;
    }
    const durationMin = Math.max(1, Math.round(totalSeconds / 60));
    try {
      const saved = await studySessionAPI.createSession({
        duration: durationMin,
        breakTime: 0,
        count: 1,
        mode: 'stopwatch',
        subject: task || null,
        startTime: sessionStartedAtRef.current || new Date().toISOString(),
      });
      toast.success(`Saved stopwatch session (${durationMin}m)!`);
      resetTimer();
      setReflectionSessionId(saved.id);
      setCoachRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(error.message || 'Failed to save study session.');
    } finally {
      sessionStartedAtRef.current = null;
    }
  }, [totalSeconds, task, resetTimer, toast]);

  // Bỏ qua phiên hiện tại (Fix lỗi 1: Skip thông minh theo chu kỳ Pomodoro)
  const handleSkip = useCallback(() => {
    if (timerMode === 'stopwatch') {
      resetTimer();
      toast.info('Đã đặt lại đồng hồ bấm giờ về 00:00');
      return;
    }

    if (currentPreset === 0) {
      // Đang học -> Chuyển sang nghỉ (sau 4 phiên học = 1 phiên nghỉ dài)
      const nextCount = completedPomodoros + 1;
      const isLongBreak = (nextCount % 4 === 0);
      const targetPreset = isLongBreak ? 2 : 1;
      setCurrentPreset(targetPreset);
      if (setTime) {
        setTime(presetTimes[targetPreset]);
      }
      toast.info(`Bỏ qua phiên học ➔ Chuyển sang ${PRESET_NAMES[targetPreset]}`);
    } else {
      // Đang nghỉ -> Chuyển về học Pomodoro
      setCurrentPreset(0);
      if (setTime) {
        setTime(presetTimes[0]);
      }
      toast.info('Bỏ qua phiên nghỉ ➔ Quay lại Pomodoro');
    }
  }, [timerMode, currentPreset, completedPomodoros, presetTimes, setTime, resetTimer, toast]);

  // HÀM XỬ LÝ THAY ĐỔI PRESET TỪ DOTS (click vào chấm tròn)
  const handlePresetDotChange = useCallback((index) => {
    setCurrentPreset(index);
    const newTime = presetTimes[index];
    if (setTime) {
      setTime(newTime);
    }
    console.log('Preset dot changed to:', PRESET_NAMES[index], `(${newTime} minutes)`);
  }, [presetTimes, setTime]);

  // ⭐ HÀM XỬ LÝ THAY ĐỔI PRESET TỪ MODAL SETTINGS (Fix lỗi 2: Lưu và hiển thị đúng preset đã chọn)
  const handleSettingsPresetChange = useCallback((presetConfig) => {
    console.log('Settings preset changed to:', presetConfig.presetName);

    const nextPresetTimes = [
      presetConfig.focusTime,
      presetConfig.shortBreak,
      presetConfig.longBreak,
    ];
    setPresetTimes(nextPresetTimes);

    const chosenPreset = presetConfig.preset || PRESETS.find(p => p.id === presetConfig.id || p.name === presetConfig.presetName) || {
      id: presetConfig.id || 'custom',
      name: presetConfig.presetName,
      focus: presetConfig.focusTime,
      short: presetConfig.shortBreak,
      long: presetConfig.longBreak,
    };
    setActivePreset(chosenPreset);

    // Cập nhật thời gian từ modal settings nếu đang ở focus mode
    if (setTime && timerMode === 'focus') {
      setTime(nextPresetTimes[currentPreset]);
    }

    // Đóng modal
    setShowSettings(false);
  }, [currentPreset, timerMode, setTime]);

  /**
   * Áp kế hoạch của Focus Coach vào timer: đặt luôn độ dài phiên, độ dài nghỉ và môn học.
   *
   * Đây là chỗ vòng lặp khép lại — kết luận AI rút ra từ các phiên trước biến thành thiết
   * lập thật của phiên sắp tới, chỉ bằng một cú bấm. Bắt user tự vào Settings gõ lại con số
   * thì phần lớn sẽ không làm, và mọi phân tích phía trước thành vô nghĩa.
   */
  const handleApplyCoachPlan = useCallback(({ durationMinutes, breakMinutes, subject }) => {
    setPresetTimes((prev) => {
      const next = [durationMinutes, breakMinutes ?? prev[1], prev[2]];
      // setTime nằm trong updater để luôn dùng đúng bộ preset vừa tính, không phải bộ cũ
      if (setTime && currentPreset === 0) {
        setTime(next[0]);
      }
      return next;
    });
    if (subject) {
      setTask(subject);
    }
    toast.success(`Đã đặt phiên ${durationMinutes} phút${subject ? ` · ${subject}` : ''}`);
  }, [currentPreset, setTime, toast]);

  const handleTogglePiP = useCallback(async () => {
    if (!('documentPictureInPicture' in window)) {
      toast.info('Picture-in-Picture is not supported. Please use Chrome 116+.');
      return;
    }

    try {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
        setIsPiPMode(false);
        return;
      }

      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 450,
        height: 280,
      });

      pipWindowRef.current = pipWindow;
      setIsPiPMode(true);

      const styleSheets = Array.from(document.styleSheets);
      styleSheets.forEach((styleSheet) => {
        try {
          const cssRules = Array.from(styleSheet.cssRules || [])
            .map((rule) => rule.cssText)
            .join('');
          const style = pipWindow.document.createElement('style');
          style.textContent = cssRules;
          pipWindow.document.head.appendChild(style);
        } catch (e) {
          const link = pipWindow.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = styleSheet.href;
          pipWindow.document.head.appendChild(link);
        }
      });

      const pipExtraStyles = pipWindow.document.createElement('style');
      pipExtraStyles.textContent = `
        .pip-container {
          background-image: url('${backgroundImage}') !important;
          background-size: cover !important;
          background-position: center !important;
        }
      `;
      pipWindow.document.head.appendChild(pipExtraStyles);

      const pipContainer = pipWindow.document.createElement('div');
      pipContainer.className = 'pip-container';
      pipContainer.innerHTML = `
        <div class="pip-content">
          <div id="pip-timer" class="pip-timer">
            ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}
          </div>
          <div class="pip-controls">
            <button id="pip-play-pause" class="pip-btn">
              ${isRunning ? 'Pause' : 'Start'}
            </button>
            <button id="pip-skip" class="pip-icon-btn" title="Skip to next">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 4 15 12 5 20 5 4"/>
                <line x1="19" y1="5" x2="19" y2="19"/>
              </svg>
            </button>
          </div>
        </div>
      `;

      pipWindow.document.body.appendChild(pipContainer);

      const playPauseBtn = pipWindow.document.getElementById('pip-play-pause');
      const skipBtn = pipWindow.document.getElementById('pip-skip');

      playPauseBtn.addEventListener('click', toggleTimer);
      skipBtn.addEventListener('click', handleSkip);

      pipWindow.addEventListener('pagehide', () => {
        pipWindowRef.current = null;
        setIsPiPMode(false);
      });

    } catch (error) {
      toast.error('Cannot open Picture-in-Picture: ' + error.message);
    }
  }, [minutes, seconds, isRunning, toggleTimer, handleSkip]);

   // ========== AUTO SAVE SESSION WHEN TIMER COMPLETES ==========
  useEffect(() => {
    if (timerMode !== 'focus') return;

    // Khi timer về 00:00 (minutes === 0 && seconds === 0) và không chạy
    if (minutes === 0 && seconds === 0 && !isRunning && currentPreset === 0) {
      if (savingSessionRef.current) return;
      savingSessionRef.current = true;

      const saveSession = async () => {
        try {
          const saved = await studySessionAPI.createSession({
            duration: presetTimes[0],
            breakTime: presetTimes[1],
            count: 1,
            mode,
            subject: task || null,
            startTime: sessionStartedAtRef.current
          });
          toast.success('Session saved!');

          // Chuyển sang phiên nghỉ: chuẩn Pomodoro là sau 4 phiên học sẽ có 1 phiên nghỉ dài
          const nextCount = completedPomodoros + 1;
          setCompletedPomodoros(nextCount);
          const isLongBreak = (nextCount % 4 === 0);
          const targetPreset = isLongBreak ? 2 : 1;
          setCurrentPreset(targetPreset);
          if (setTime) {
            setTime(presetTimes[targetPreset]);
          }

          if (isLongBreak) {
            toast.success(`🎉 Xuất sắc! Đã hoàn thành 4 phiên Pomodoro. Hãy nghỉ ngơi dài ${presetTimes[2]} phút nhé!`);
          } else {
            toast.success(`☕ Hoàn thành phiên học! Nghỉ ngơi ${presetTimes[1]} phút nào.`);
          }

          // Mở popup reflection (user trả lời trong lúc nghỉ, có thể skip)
          setReflectionSessionId(saved.id);
          // Phiên vừa xong đã là dữ liệu mới: buộc coach dựng lại kế hoạch cho lần sau
          setCoachRefreshKey((k) => k + 1);

        } catch (error) {
          toast.error(error.message || 'Failed to save session.');
          savingSessionRef.current = false;
        } finally {
          sessionStartedAtRef.current = null;
        }
      };
      
      saveSession();
    } else if (!(minutes === 0 && seconds === 0)) {
      // Timer đã rời mốc 00:00 → phiên kế tiếp được phép lưu
      savingSessionRef.current = false;
    }
  }, [minutes, seconds, isRunning, currentPreset, presetTimes, mode, task, completedPomodoros, timerMode, setTime, toast]);

  // Khi phiên nghỉ kết thúc (Short Break hoặc Long Break về 00:00)
  const breakFinishedRef = useRef(false);
  useEffect(() => {
    if (timerMode !== 'focus') return;

    if (minutes === 0 && seconds === 0 && !isRunning && currentPreset !== 0) {
      if (breakFinishedRef.current) return;
      breakFinishedRef.current = true;
      toast.success('⏰ Hết giờ nghỉ ngơi rồi! Sẵn sàng cho phiên tập trung tiếp theo.');
      setCurrentPreset(0);
      if (setTime) {
        setTime(presetTimes[0]);
      }
    } else if (!(minutes === 0 && seconds === 0)) {
      breakFinishedRef.current = false;
    }
  }, [minutes, seconds, isRunning, currentPreset, presetTimes, timerMode, setTime, toast]);

  const handleTaskChange = useCallback((e) => {
    setTask(e.target.value);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const isBreakMode = currentPreset !== 0;

  // ========== RENDER ==========
  return (
    <div className="timer-container">
      {/* Underlying thumbnail image layer (ensures zero-flash background) */}
      <div
        className="timer-background"
        style={{ backgroundImage: `url(${scene.thumbnail || (scene.type !== 'video' ? scene.url : '') || backgroundImage})` }}
        role="presentation"
      />

      {/* Motion / Video background */}
      {scene.type === 'video' && !videoError && (
        (() => {
          const ytId = getYouTubeId(scene.url);
          if (ytId) {
            return (
              <iframe
                key={ytId}
                className={`timer-background-iframe ${videoLoaded ? 'loaded' : 'loading'}`}
                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&modestbranding=1&fs=0`}
                title="Focus Scene Background"
                frameBorder="0"
                tabIndex="-1"
                aria-hidden="true"
                allow="autoplay; encrypted-media"
                allowFullScreen
                onLoad={() => {
                  setTimeout(() => {
                    setVideoLoaded(true);
                  }, 1200);
                }}
                onError={() => setVideoError(true)}
              />
            );
          }
          return (
            <video
              key={scene.url}
              className={`timer-background-video ${videoLoaded ? 'loaded' : 'loading'}`}
              src={scene.url}
              poster={scene.thumbnail}
              autoPlay
              loop
              muted
              playsInline
              onLoadedData={() => setVideoLoaded(true)}
              onError={() => setVideoError(true)}
              role="presentation"
            />
          );
        })()
      )}

      {/* Weather Particle Overlays */}
      {scene.weather === 'rain' && <RainOverlay />}
      {scene.weather === 'snow' && <SnowOverlay />}
      {scene.weather === 'storm' && <StormOverlay />}

      <div 
        className="timer-overlay" 
        style={{ backgroundColor: `rgba(0, 0, 0, ${scene.opacity})` }} 
        role="presentation" 
      />

<header className="timer-header">
        <div className="logo">
          <span className="logo-icon" aria-hidden="true">
            <img src={targetIcon} alt="" className="logo-icon-svg" width="28" height="28" />
          </span>
          <span className="logo-text">DoroStudy</span>
          <button
            className="deep-focus-btn"
            onClick={handleToggleDeepFocus}
            aria-label="Enter deep focus mode"
            title="Bật/Tắt chế độ tập trung toàn màn hình"
          >
            <img src={focusLightning} alt="" className="deep-focus-icon" width="16" height="16" />
            Deep Focus
          </button>
        </div>

        <div className="header-right">
          <button
            className="stat-btn"
            aria-label="Streak: 1"
            title="Chuỗi ngày học tập liên tục (Streak)"
            onClick={() => toast.info('🔥 Chuỗi học tập: 1 ngày liên tục. Cố lên nhé!')}
          >
            <img src={fireIcon} alt="" className="header-stat-icon" width="18" height="18" />
            <span>1</span>
          </button>
          <button
            className="stat-btn"
            aria-label="Study time: 0 minutes"
            title="Tổng thời gian tập trung hôm nay"
            onClick={() => toast.info('⏱️ Tổng thời gian học hôm nay: Hoàn thành phiên để tích lũy!')}
          >
            <img src={stopwatchIcon} alt="" className="header-stat-icon" width="18" height="18" />
            <span>0m</span>
          </button>
          <button
            className="stat-btn"
            aria-label="Statistics"
            title="Xem hồ sơ tập trung & thống kê (Focus Insights)"
            onClick={() => setShowFocusProfile(true)}
          >
            <img src={chartIcon} alt="" className="header-stat-icon" width="18" height="18" />
          </button>
          <button
            className="stat-btn"
            aria-label="Notifications"
            title="Thông báo"
            onClick={() => toast.info('🔔 Không có thông báo mới. Chúc bạn một phiên học hiệu quả!')}
          >
            <img src={bellIcon} alt="" className="header-stat-icon" width="18" height="18" />
          </button>
          <button
            className="user-menu"
            aria-label="Enter user's study room"
            title="Phòng học cá nhân"
            onClick={() => toast.info("🏠 Bạn đang ở trong phòng học cá nhân của mình.")}
          >
            {currentUser ? `${currentUser.name || currentUser.username}'s room` : "User's room"}
          </button>

          <div className="user-menu-wrapper" ref={userMenuRef}>
            <button
              onClick={handleToggleUserMenu}
              className="login-nav-btn"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              aria-label="User menu"
            >
              {currentUser?.image ? (
                <img
                  src={currentUser.image}
                  alt={currentUser.name || 'User avatar'}
                  className="login-nav-avatar"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                userInitials
              )}
            </button>

            {showUserMenu && (
              <div className="user-dropdown-menu" role="menu">
                <UserDropdownHeader user={currentUser} onClose={handleCloseUserMenu} />
                <div className="user-dropdown-divider" />
                <UserMenuSection
                  items={MENU_ITEMS}
                  onItemClick={handleMenuItemClick}
                />
                <UserMenuSection
                  items={EXTERNAL_ITEMS}
                  onItemClick={handleMenuItemClick}
                />
                <UserMenuSection
                  items={footerMenuItems}
                  isLast
                  onItemClick={handleMenuItemClick}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="timer-content">
        {timerMode === 'focus' ? (
          <div className="pomodoro-header-section">
            <PresetDots
              currentPreset={currentPreset}
              onPresetChange={handlePresetDotChange}
            />
            <div className="cycle-pill" title="Pomodoro Cycle: 4 study sessions followed by a long break">
              {currentPreset === 0 ? `Session ${(completedPomodoros % 4) + 1}/4` : PRESET_NAMES[currentPreset]}
            </div>
          </div>
        ) : (
          <div className="stopwatch-badge-header">
            <span className="stopwatch-live-dot" />
            <span>STOPWATCH MODE</span>
          </div>
        )}

        <div className="timer-display">
          <h1 className="time">
            {timerMode === 'stopwatch' && hours > 0
              ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
              : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
          </h1>
        </div>

        <div className="task-input-wrapper">
          <span className="task-icon" aria-hidden="true">☰</span>
          <input
            type="text"
            className="task-input"
            placeholder="What are you working on?"
            value={task}
            onChange={handleTaskChange}
            aria-label="Current task"
          />
        </div>

        {/* Nhắc chủ động: chỉ hiện khi thật sự có chuyện (chuỗi sắp đứt, đang tụt nhịp...) */}
        <NudgeBanner onAct={handleApplyCoachPlan} refreshKey={coachRefreshKey} />

        {/* AI trước phiên học: gợi ý môn/độ dài/khung giờ và dự đoán điểm.
            Ẩn khi đang chạy hoặc đang nghỉ — lúc đó user cần đồng hồ, không cần lời khuyên. */}
        {timerMode === 'focus' && (
          <NextSessionCard
            subject={task}
            disabled={isRunning || currentPreset !== 0}
            onApply={handleApplyCoachPlan}
            refreshKey={coachRefreshKey}
          />
        )}

        <div className="control-section">
          <button
            className="settings-icon-btn"
            onClick={handleOpenSettings}
            aria-label="Open settings"
            title="Preset Settings & Timer Mode"
          >
            <img
              src={settingClockIcon}
              alt="Settings"
              className="settings-icon-img"
              width="24"
              height="24"
            />
          </button>

          {/* SỬA LỖI 1: Nút chính luôn là Start/Pause để bắt đầu cả phiên học lẫn phiên nghỉ */}
          <button
            onClick={toggleTimer}
            className="start-btn-large"
            aria-label={isRunning ? 'Pause timer' : 'Start timer'}
          >
            {isRunning ? 'Pause' : 'Start'}
          </button>

          {/* Nút Reset cho Stopwatch */}
          {timerMode === 'stopwatch' && (
            <button
              className="reset-btn"
              onClick={resetTimer}
              title="Reset to 00:00"
              aria-label="Reset stopwatch"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          )}

          {/* Nút Lưu phiên cho Stopwatch khi đã học được trên 1 phút */}
          {timerMode === 'stopwatch' && totalSeconds >= 60 && !isRunning && (
            <button
              className="save-stopwatch-btn"
              onClick={handleSaveStopwatchSession}
              title="Save session to profile"
            >
              Save session ({Math.max(1, Math.round(totalSeconds / 60))}m)
            </button>
          )}

          <button
            className="pip-btn-main"
            onClick={handleTogglePiP}
            aria-label="Toggle Picture-in-Picture"
            title="Picture-in-Picture"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <rect x="13" y="13" width="6" height="6" rx="1" />
            </svg>
          </button>

          {timerMode === 'focus' && (
            <button
              className="skip-btn"
              onClick={handleSkip}
              aria-label="Skip to next stage"
              title={currentPreset === 0 ? "Bỏ qua phiên học ➔ Sang nghỉ" : "Bỏ qua nghỉ ➔ Quay lại Pomodoro"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <footer className="timer-footer">
        <FooterButtonsGroup
          buttons={FOOTER_BUTTONS_LEFT}
          direction="left"
          onButtonClick={(id) => {
            if (id === 'notes') setShowNotes(true);
            if (id === 'music') setShowMusic(prev => !prev);
            if (id === 'background' || id === 'cloud') setShowBackground(true);
          }}
        />
        <FooterButtonsGroup
          buttons={FOOTER_BUTTONS_RIGHT}
          direction="right"
          onButtonClick={(id) => {
            if (id === 'user') setShowProfile(true);
            if (id === 'chat') toast.info('💬 Room Chat: Bạn đang ở chế độ phòng học cá nhân.');
            if (id === 'deepfocus') handleToggleDeepFocus();
            if (id === 'clock') setShowFocusProfile(true);
          }}
        />
      </footer>

      {/* SỬA LỖI 2 & 3: Truyền preset hiện tại và mode để modal đồng bộ chuẩn */}
      {showSettings && (
        <SettingsModal
          onClose={handleCloseSettings}
          onPresetChange={handleSettingsPresetChange}
          currentPresetObj={activePreset}
          currentPresetTimes={presetTimes}
          timerMode={timerMode}
          onTimerModeChange={handleTimerModeChange}
          deepFocus={isDeepFocus}
          onToggleDeepFocus={handleToggleDeepFocus}
        />
      )}
      {showProfile && (
        <ProfilePage onClose={() => setShowProfile(false)} />
      )}
      {showNotes && (
        <NotesPanel onClose={() => setShowNotes(false)} />
      )}
      <MusicModal
        isOpen={showMusic}
        onClose={() => setShowMusic(false)}
        videoId={musicVideoId}
        onUpdateVideoId={setMusicVideoId}
      />
      {showBackground && (
        <BackgroundModal
          onClose={() => setShowBackground(false)}
          scene={scene}
          onChangeScene={setScene}
        />
      )}
      {showFocusProfile && (
        <FocusProfilePanel onClose={() => setShowFocusProfile(false)} />
      )}
      {reflectionSessionId && (
              <ReflectionModal
                sessionId={reflectionSessionId}
                subject={task || null}
                onAdoptSubject={(detected) => setTask(detected)}
                onApplyPlan={handleApplyCoachPlan}
                onClose={() => setReflectionSessionId(null)}
              />
      )}
    </div>
  );
}

// ========== WEATHER PARTICLE COMPONENTS ==========
function RainOverlay() {
  const drops = Array.from({ length: 80 });
  return (
    <div className="weather-overlay rain-overlay" role="presentation">
      {drops.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 0.8 + Math.random() * 0.5;
        const opacity = 0.3 + Math.random() * 0.4;
        return (
          <div
            key={i}
            className="rain-drop"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              opacity: opacity,
            }}
          />
        );
      })}
    </div>
  );
}

function SnowOverlay() {
  const flakes = Array.from({ length: 60 });
  return (
    <div className="weather-overlay snow-overlay" role="presentation">
      {flakes.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 5;
        const duration = 3 + Math.random() * 4;
        const size = 3 + Math.random() * 4;
        const opacity = 0.5 + Math.random() * 0.4;
        return (
          <div
            key={i}
            className="snow-flake"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              width: `${size}px`,
              height: `${size}px`,
              opacity: opacity,
            }}
          />
        );
      })}
    </div>
  );
}

function StormOverlay() {
  return (
    <div className="weather-overlay storm-overlay" role="presentation">
      <div className="lightning-flash" />
      <RainOverlay />
    </div>
  );
}
