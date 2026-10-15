import { useLanguage } from '../../hooks/useLanguage';
import { translate as t } from '../../lib/locale';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChartNoAxesCombined, CircleHelp, CloudRain, Image, ListTodo, Maximize2, MessageSquareText, Music2, NotebookPen, Settings2, UserRound } from 'lucide-react';
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
import StudyBackground from './StudyBackground';
import TimerPictureInPicture from './TimerPictureInPicture';
import ReflectionModal from '../reflection/ReflectionModal';
import FocusProfilePanel from '../insights/FocusProfilePanel';
import NextSessionCard from '../coach/NextSessionCard';
import NudgeBanner from '../coach/NudgeBanner';
import OnboardingGuide, { ONBOARDING_KEY } from '../onboarding/OnboardingGuide';
import { captureEvent } from '../../lib/analytics';
import { rememberFeedbackCampaign } from '../../lib/feedbackCampaign';
import LanguageSwitcher from '../language/LanguageSwitcher';

const FeedbackDialog = React.lazy(() => import('../feedback/FeedbackDialog'));

// SVG Icon imports
import profileIcon from '../../assets/user-menu/profile.svg';
import settingsIcon from '../../assets/user-menu/setting.svg';
import logoutIcon from '../../assets/user-menu/logout.svg';
import focusLightning from '../../assets/ground/lightning.svg';
import targetIcon from '../../assets/ground/target.svg';

// ========== STATIC CONFIGS ==========
const MENU_ITEMS = [
  { id: 'profile', icon: profileIcon, text: 'Hồ sơ học tập', arrow: true, type: 'svg' },
  { id: 'focusdna', icon: ChartNoAxesCombined, text: 'Hồ sơ tập trung', arrow: true, type: 'lucide' },
  { id: 'guide', icon: CircleHelp, text: 'Hướng dẫn trên màn hình', arrow: true, type: 'lucide' },
  { id: 'feedback', icon: MessageSquareText, text: 'Góp ý sản phẩm', arrow: true, type: 'lucide' },
  { id: 'settings', icon: settingsIcon, text: 'Cài đặt ứng dụng', arrow: true, type: 'svg' },
];

const PRESET_NAMES = ['Tập trung', 'Nghỉ ngắn', 'Nghỉ dài'];
const TIMER_MODES = ['focus', 'short_break', 'long_break'];
const DEFAULT_PRESET_TIMES = [PRESETS[0].focus, PRESETS[0].short, PRESETS[0].long];
const PENDING_REFLECTION_KEY = 'dorostudy.pendingReflection';

const FOOTER_BUTTONS_LEFT = [
  { id: 'cloud', icon: CloudRain, label: 'Thời tiết' },
  { id: 'music', icon: Music2, label: 'Âm nhạc' },
  { id: 'background', icon: Image, label: 'Hình nền' },
  { id: 'notes', icon: NotebookPen, label: 'Ghi chú' },
];

const FOOTER_BUTTONS_RIGHT = [
  { id: 'user', icon: UserRound, label: 'Hồ sơ' },
  { id: 'progress', icon: ChartNoAxesCombined, label: 'Tiến trình' },
  { id: 'deepfocus', icon: Maximize2, label: 'Toàn màn hình' },
];

// ========== MEMOIZED COMPONENTS ==========
const IconRenderer = React.memo(({ icon, type }) => {
  useLanguage();
  if (type === 'lucide') {
    const Icon = icon;
    return <Icon size={18} strokeWidth={1.7} />;
  }
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
  useLanguage();
  const handleClick = useCallback(() => {
    onItemClick(item.id);
  }, [item.id, onItemClick]);

  return (
    <button className="user-dropdown-item" onClick={handleClick}>
      <span className="item-icon">
        <IconRenderer icon={item.icon} type={item.type} />
      </span>
      <span className="item-text">{t(item.text)}</span>
      <span className={item.arrow ? 'item-arrow' : 'item-external'}>
        {item.arrow ? '›' : '↗'}
      </span>
    </button>
  );
});
UserMenuItemComponent.displayName = 'UserMenuItemComponent';

const UserMenuSection = React.memo(({ items, isLast, onItemClick }) => {
  useLanguage();
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
  useLanguage();
  return (
    <div className="preset-dots" data-tour="modes" role="group" aria-label={t("Chế độ đồng hồ")}>
      {PRESET_NAMES.map((name, index) => (
        <button
          key={name}
          type="button"
          className={`preset-dot ${currentPreset === index ? 'active' : ''}`}
          onClick={() => onPresetChange(index)}
          aria-label={t("Chọn {0}", [name.toLowerCase()])}
          aria-pressed={currentPreset === index}
          title={t(name)}
        >{t(name)}</button>
      ))}
    </div>
  );
});
PresetDots.displayName = 'PresetDots';

const FooterButtonsGroup = React.memo(({ buttons, direction, onButtonClick }) => {
  useLanguage();
  return (
    <div className={`footer-${direction}`} data-tour={direction === 'left' ? 'tools' : undefined}>
      {buttons.map(btn => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.id}
            className="footer-btn"
            aria-label={t(btn.label)}
            title={t(btn.label)}
            onClick={() => onButtonClick?.(btn.id)}
          >
            <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
            <span className="footer-btn-label">{t(btn.label)}</span>
          </button>
        );
      })}
    </div>
  );
});
FooterButtonsGroup.displayName = 'FooterButtonsGroup';

const UserDropdownHeader = React.memo(({ user, onClose }) => {
  useLanguage();
  const displayName = user ? (user.name || user.username) : t("Khách");
  const subtitle = user 
    ? (user.email || (user.status === 'ACTIVE' ? t("Tài khoản đang hoạt động") : t("Thành viên")))
    : t("Chưa đăng nhập");

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
        aria-label={t("Đóng menu")}
      >
        ✕
      </button>
    </div>
  );
});
UserDropdownHeader.displayName = 'UserDropdownHeader';


// ========== MAIN COMPONENT ==========
export default function PomodoroTimer() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const toast = useToast();
  const { minutes, seconds, isRunning, toggleTimer, setTime } = useTimer(DEFAULT_PRESET_TIMES[0]);

  // States
  const mode = 'pomodoro';
  const [showSettings, setShowSettings] = useState(false);
  const [task, setTask] = useState('');
  const [currentPreset, setCurrentPreset] = useState(0);
  const [presetTimes, setPresetTimes] = useState(DEFAULT_PRESET_TIMES);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [musicVideoId, setMusicVideoId] = useState('jfKfPfyJRdk'); // default lofi girl stream
  const [showBackground, setShowBackground] = useState(false);
  // sessionId của phiên vừa lưu — có giá trị thì hiện popup reflection
  const [reflectionSessionId, setReflectionSessionId] = useState(null);
  const [showFocusProfile, setShowFocusProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState(null);

  useEffect(() => { rememberFeedbackCampaign(); }, []);
  const [showOnboarding, setShowOnboarding] = useState(
    () => {
      try { return localStorage.getItem(ONBOARDING_KEY) !== 'done'; } catch { return true; }
    },
  );

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
        { id: 'login', icon: logoutIcon, text: 'Đăng nhập / Đăng ký', arrow: true, type: 'svg' },
      ];
    }
    return [
      { id: 'logout', icon: logoutIcon, text: 'Đăng xuất', external: true, type: 'svg' },
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
  const alertAudioContextRef = useRef(null);

  const [scene, setScene] = useState({
    type: 'image',
    url: backgroundImage,
    thumbnail: backgroundImage,
    id: 'default',
    opacity: 0.3,
    weather: 'clear',
  });
  const handleToggleDeepFocus = useCallback(() => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      toast.success(t("⚡ Đã bật chế độ tập trung toàn màn hình"));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      toast.info(t("Đã thoát chế độ tập trung sâu"));
    }
  }, [toast]);

  // Refs
  const userMenuRef = useRef(null);
  const [showProfile, setShowProfile] = useState(false);
  const pipWindowRef = useRef(null);
  const pipOpeningRef = useRef(false);
  const pipMountedRef = useRef(false);
  const [pipWindow, setPipWindow] = useState(null);

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
  
  // PiP renders through a portal, so controls, scene and language use live React state.
  useEffect(() => {
    pipMountedRef.current = true;
    return () => {
      pipMountedRef.current = false;
      pipWindowRef.current?.close();
      pipWindowRef.current = null;
    };
  }, []);

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

  // Khôi phục khảo sát chưa làm nếu người dùng tải lại trang sau khi phiên kết thúc.
  useEffect(() => {
    if (!currentUser) return;
    try {
      const pending = JSON.parse(localStorage.getItem(PENDING_REFLECTION_KEY));
      if (pending?.sessionId && Number(pending.userId) === Number(currentUser.id)) {
        setReflectionSessionId(pending.sessionId);
      }
    } catch {
      localStorage.removeItem(PENDING_REFLECTION_KEY);
    }
  }, [currentUser]);

  useEffect(() => {
    const originalTitle = 'DoroStudy';
    document.title = reflectionSessionId
      ? t("● Bạn có khảo sát sau phiên học | DoroStudy")
      : originalTitle;
    return () => { document.title = originalTitle; };
  }, [reflectionSessionId, language]);

  const prepareCompletionAlert = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    try {
      if (!alertAudioContextRef.current) {
        alertAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      alertAudioContextRef.current.resume?.();
    } catch {
      // Thiết bị không hỗ trợ Web Audio vẫn nhận được popup trong ứng dụng.
    }
  }, []);

  const handleTimerToggle = useCallback(() => {
    if (!isRunning) prepareCompletionAlert();
    if (isRunning || minutes > 0 || seconds > 0) {
      captureEvent(isRunning ? 'timer_paused' : 'timer_started', {
        mode: TIMER_MODES[currentPreset],
        duration_minutes: presetTimes[currentPreset],
      });
    }
    toggleTimer();
  }, [isRunning, minutes, seconds, currentPreset, presetTimes, prepareCompletionAlert, toggleTimer]);

  const announceReflection = useCallback(async (sessionId) => {
    try {
      const audioContext = alertAudioContextRef.current;
      if (audioContext) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.14);
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.42);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.45);
      }
    } catch {
      // Âm báo là tăng cường, không được làm hỏng luồng lưu phiên.
    }

    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const options = {
        body: t("Quay lại DoroStudy để hoàn thành khảo sát ngắn và nhận gợi ý cho phiên tiếp theo."),
        tag: 'dorostudy-reflection',
        renotify: true,
        requireInteraction: true,
        data: { type: 'reflection', sessionId, url: '/' },
      };
      try {
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration) {
          await registration.showNotification(t("Phiên học đã hoàn thành 🎉"), options);
        } else {
          const notification = new Notification(t("Phiên học đã hoàn thành 🎉"), options);
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }
      } catch {
        // Tiêu đề tab và popup chờ sẵn vẫn là hai lớp nhắc dự phòng.
      }
    }
  }, []);



  // ========== HANDLERS ==========
  const handleToggleUserMenu = useCallback(() => {
    setShowUserMenu(prev => !prev);
  }, []);

  const handleCloseUserMenu = useCallback(() => {
    setShowUserMenu(false);
  }, []);

  const handleOpenGuide = useCallback(() => {
    captureEvent('feature_opened', { feature: 'guide' });
    setShowUserMenu(false);
    setShowSettings(false);
    setShowNotes(false);
    setShowMusic(false);
    setShowBackground(false);
    setShowProfile(false);
    setShowFocusProfile(false);
    setShowOnboarding(true);
  }, []);

const handleMenuItemClick = useCallback(async (itemId) => {
  if (itemId === 'feedback') {
    setFeedbackForm({ initialKind: 'ux', entryPoint: 'user_menu' });
    setShowUserMenu(false);
    return;
  }
  if (itemId === 'profile') {
    captureEvent('feature_opened', { feature: 'profile' });
    setShowProfile(true);
    setShowUserMenu(false);
    return;
  }

  if (itemId === 'focusdna') {
    captureEvent('feature_opened', { feature: 'insights' });
    setShowFocusProfile(true);
    setShowUserMenu(false);
    return;
  }

  if (itemId === 'guide') {
    handleOpenGuide();
    return;
  }

  if (itemId === 'settings') {
    captureEvent('feature_opened', { feature: 'settings' });
    setShowSettings(true);
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
      localStorage.removeItem(PENDING_REFLECTION_KEY);
      setCurrentUser(null);
      navigate('/login');
    } catch (error) {
      toast.error(error.message || t("Đăng xuất thất bại."));
    }
    setShowUserMenu(false);
    return;
  }

  console.log('Menu item clicked:', itemId);
  setShowUserMenu(false);
}, [navigate, toast, handleOpenGuide]);


  const handleSkipToBreak = useCallback(() => {
    const nextPreset = (currentPreset + 1) % PRESET_NAMES.length;
    captureEvent('timer_skipped', {
      from_mode: TIMER_MODES[currentPreset],
      to_mode: TIMER_MODES[nextPreset],
    });
    setCurrentPreset(nextPreset);
    const newTime = presetTimes[nextPreset];
    if (setTime) {
      setTime(newTime);
    }
    console.log('Skipped to:', PRESET_NAMES[nextPreset], `(${newTime} minutes)`);
  }, [currentPreset, presetTimes, setTime]);

  // Khi một phiên tập trung kết thúc, giờ nghỉ phải bắt đầu ngay. Trước đây luồng này
  // chỉ đổi preset rồi dừng timer, khiến người dùng chỉ còn cách bấm Skip.
  const handleStartBreak = useCallback(() => {
    const nextPreset = currentPreset === 0 ? 1 : currentPreset;
    captureEvent('timer_started', {
      mode: TIMER_MODES[nextPreset],
      duration_minutes: presetTimes[nextPreset],
    });
    setCurrentPreset(nextPreset);
    setTime?.(presetTimes[nextPreset], true);
  }, [currentPreset, presetTimes, setTime]);

  const handleSkipBreakToPomodoro = useCallback((completed = false) => {
    if (completed !== true) {
      captureEvent('timer_skipped', {
        from_mode: TIMER_MODES[currentPreset],
        to_mode: TIMER_MODES[0],
      });
    }
    setCurrentPreset(0);
    if (setTime) {
      setTime(presetTimes[0]);
    }
    console.log('Break skipped: back to Pomodoro');
  }, [currentPreset, presetTimes, setTime]);

  // Hết giờ nghỉ thì đưa giao diện về phiên tập trung tiếp theo, sẵn sàng để người dùng
  // chủ động bấm Start. Không để màn hình kẹt ở 00:00 của break.
  useEffect(() => {
    if (currentPreset !== 0 && minutes === 0 && seconds === 0 && !isRunning) {
      handleSkipBreakToPomodoro(true);
      toast.info(t("Giờ nghỉ đã kết thúc. Sẵn sàng cho phiên tiếp theo!"));
    }
  }, [currentPreset, minutes, seconds, isRunning, handleSkipBreakToPomodoro, toast]);

  // HÀM XỬ LÝ THAY ĐỔI PRESET TỪ DOTS (click vào chấm tròn)
  const handlePresetDotChange = useCallback((index) => {
    if (index !== currentPreset) captureEvent('timer_mode_changed', { mode: TIMER_MODES[index] });
    setCurrentPreset(index);
    const newTime = presetTimes[index];
    if (setTime) {
      setTime(newTime);
    }
    console.log('Preset dot changed to:', PRESET_NAMES[index], `(${newTime} minutes)`);
  }, [currentPreset, presetTimes, setTime]);

  // ⭐ HÀM XỬ LÝ THAY ĐỔI PRESET TỪ MODAL SETTINGS
  const handleSettingsPresetChange = useCallback((presetConfig) => {
    captureEvent('timer_preset_applied', {
      focus_minutes: presetConfig.focusTime,
      short_break_minutes: presetConfig.shortBreak,
      long_break_minutes: presetConfig.longBreak,
    });
    console.log('Settings preset changed to:', presetConfig.presetName);

    const nextPresetTimes = [
      presetConfig.focusTime,
      presetConfig.shortBreak,
      presetConfig.longBreak,
    ];
    setPresetTimes(nextPresetTimes);

    // Cập nhật thời gian từ modal settings
    if (setTime) {
      setTime(nextPresetTimes[currentPreset]);
    }

    // Đóng modal
    setShowSettings(false);
  }, [currentPreset, setTime]);

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
    toast.success(t("Đã đặt phiên {0} phút{1}", [durationMinutes, subject ? ` · ${subject}` : '']));
  }, [currentPreset, setTime, toast]);

  const handleTogglePiP = useCallback(async () => {
    if (!window.documentPictureInPicture?.requestWindow) {
      toast.info(t("Trình duyệt chưa hỗ trợ cửa sổ đồng hồ thu nhỏ. Hãy dùng Chrome 116 trở lên."));
      return;
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setPipWindow(null);
      return;
    }
    if (pipOpeningRef.current) return;
    pipOpeningRef.current = true;
    let opened;
    try {
      opened = await window.documentPictureInPicture.requestWindow({ width: 450, height: 280 });
      if (!pipMountedRef.current || opened.closed) { opened.close(); return; }
      opened.document.documentElement.style.backgroundColor = '#151c24';
      const base = opened.document.createElement('base');
      base.href = document.baseURI;
      opened.document.head.appendChild(base);
      pipWindowRef.current = opened;
      opened.addEventListener('pagehide', () => {
        if (pipWindowRef.current !== opened) return;
        pipWindowRef.current = null;
        if (pipMountedRef.current) setPipWindow(null);
      }, { once: true });
      setPipWindow(opened);
    } catch (error) {
      opened?.close();
      if (pipMountedRef.current) toast.error(t("Không thể mở đồng hồ thu nhỏ: ") + error.message);
    } finally {
      pipOpeningRef.current = false;
    }
  }, [toast]);

   // ========== AUTO SAVE SESSION WHEN TIMER COMPLETES ==========
  useEffect(() => {
    // Khi timer về 00:00 (minutes === 0 && seconds === 0) và không chạy
    if (minutes === 0 && seconds === 0 && !isRunning && currentPreset === 0) {
      // Chỉ lưu khi là phiên Pomodoro (currentPreset === 0), và chỉ lưu một lần
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
          captureEvent('study_session_completed', {
            duration_minutes: presetTimes[0],
            break_minutes: presetTimes[1],
          });
          toast.success(t("Đã lưu phiên học. Hãy dành 15 giây để phản hồi nhé!"));
          handleStartBreak();
          // Mở popup reflection (user trả lời trong lúc nghỉ, có thể skip)
          setReflectionSessionId(saved.id);
          localStorage.setItem(PENDING_REFLECTION_KEY, JSON.stringify({
            sessionId: saved.id,
            userId: currentUser?.id,
          }));
          announceReflection(saved.id);
          // Phiên vừa xong đã là dữ liệu mới: buộc coach dựng lại kế hoạch cho lần sau
          setCoachRefreshKey((k) => k + 1);

        } catch (error) {
          toast.error(error.message || t("Không thể lưu phiên học."));
          // Lưu thất bại thì mở lại chốt để user có thể thử lại phiên sau
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
  }, [minutes, seconds, isRunning, currentPreset, presetTimes, mode, task, handleStartBreak, toast, currentUser, announceReflection]);

  const handleTaskChange = useCallback((e) => {
    setTask(e.target.value);
  }, []);

  const handleOpenSettings = useCallback(() => {
    captureEvent('feature_opened', { feature: 'settings' });
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const isBreakMode = currentPreset !== 0;

  // ========== RENDER ==========
  return (
    <div className={`timer-container ${showOnboarding ? 'is-touring' : ''}`}>
      <StudyBackground scene={scene} />

<header className="timer-header">
        <div className="logo">
          <span className="logo-icon" aria-hidden="true">
            <img src={targetIcon} alt="" className="logo-icon-svg" width="28" height="28" />
          </span>
          <span className="logo-text">DoroStudy</span>
          <button
            className="deep-focus-btn"
            onClick={handleToggleDeepFocus}
            aria-label={t("Bật chế độ tập trung sâu")}
            title={t("Bật/Tắt chế độ tập trung toàn màn hình")}
          >
            <img src={focusLightning} alt="" className="deep-focus-icon" width="16" height="16" />{t("Tập trung sâu")}</button>
        </div>

        <div className="header-right">
          <LanguageSwitcher />
          <button
            type="button"
            className="tour-help-btn"
            data-tour="help"
            aria-label={t("Hướng dẫn trên màn hình")}
            onClick={handleOpenGuide}
          >
            <CircleHelp size={18} strokeWidth={1.7} /><span>{t("Hướng dẫn")}</span>
          </button>
          <button
            className="stat-btn"
            data-tour="progress"
            aria-label={t("Thống kê")}
            title={t("Xem hồ sơ tập trung và thống kê")}
            onClick={() => {
              captureEvent('feature_opened', { feature: 'insights' });
              setShowFocusProfile(true);
            }}
          >
            <ChartNoAxesCombined size={18} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <button
            className={`stat-btn ${reflectionSessionId ? 'has-attention' : ''}`}
            data-tour="notifications"
            aria-label={t("Thông báo")}
            title={reflectionSessionId ? t("Bạn có khảo sát sau phiên học đang chờ") : t("Thông báo")}
            onClick={() => toast.info(reflectionSessionId
              ? t("📝 Khảo sát sau phiên học đang mở. Hoàn thành để AI hiểu bạn hơn nhé!")
              : t("🔔 Không có thông báo mới. Chúc bạn một phiên học hiệu quả!"))}
          >
            <Bell size={18} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <div className="user-menu-wrapper" ref={userMenuRef}>
            <button
              onClick={handleToggleUserMenu}
              className="login-nav-btn"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              aria-label={t("Menu tài khoản")}
            >
              {currentUser?.image ? (
                <img
                  src={currentUser.image}
                  alt={currentUser.name || t("Ảnh đại diện")}
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
        {/* SỬA: Truyền handlePresetDotChange thay vì handlePresetChange */}
        <PresetDots
          currentPreset={currentPreset}
          onPresetChange={handlePresetDotChange}
        />

        <div className="timer-display">
          <h1 className="time">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </h1>
        </div>

        <div className="task-input-wrapper" data-tour="task">
          <ListTodo size={18} strokeWidth={1.7} className="task-icon" aria-hidden="true" />
          <input
            type="text"
            className="task-input"
            placeholder={t("Bạn đang tập trung làm gì?")}
            value={task}
            onChange={handleTaskChange}
            aria-label={t("Việc đang tập trung")}
          />
        </div>

        {/* Nhắc chủ động: chỉ hiện khi thật sự có chuyện (chuỗi sắp đứt, đang tụt nhịp...) */}
        <NudgeBanner onAct={handleApplyCoachPlan} refreshKey={coachRefreshKey} />

        {/* AI trước phiên học: gợi ý môn/độ dài/khung giờ và dự đoán điểm.
            Ẩn khi đang chạy hoặc đang nghỉ — lúc đó user cần đồng hồ, không cần lời khuyên. */}
        <NextSessionCard
          userId={currentUser?.id}
          subject={task}
          disabled={isRunning || currentPreset !== 0}
          onApply={handleApplyCoachPlan}
          refreshKey={coachRefreshKey}
        />

        <div className="control-section">
          <button
            className="settings-icon-btn"
            data-tour="settings"
            onClick={handleOpenSettings}
            aria-label={t("Mở cài đặt")}
          >
            <Settings2 size={20} strokeWidth={1.7} aria-hidden="true" />
          </button>

          <button
            onClick={handleTimerToggle}
            className="start-btn-large"
            data-tour="start"
            aria-label={
              isRunning ? t("Tạm dừng đồng hồ") : t("Bắt đầu {0}", [isBreakMode ? 'giờ nghỉ' : 'phiên học'])
            }
          >
            {isRunning ? t("Tạm dừng") : t("Bắt đầu")}
          </button>

          <button
            className="pip-btn-main"
            onClick={handleTogglePiP}
            aria-label={t("Bật hoặc tắt đồng hồ thu nhỏ")}
            title={t("Đồng hồ thu nhỏ")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <rect x="13" y="13" width="6" height="6" rx="1" />
            </svg>
          </button>

          <button
            className="skip-btn"
            onClick={isBreakMode ? handleSkipBreakToPomodoro : handleSkipToBreak}
            aria-label={t("Chuyển sang giai đoạn tiếp theo")}
            title={isBreakMode ? t("Bỏ qua giờ nghỉ") : t("Chuyển sang giờ nghỉ")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        </div>
      </div>

      <footer className="timer-footer">
        <FooterButtonsGroup
          buttons={FOOTER_BUTTONS_LEFT}
          direction="left"
          onButtonClick={(id) => {
            if (id === 'notes') {
              captureEvent('feature_opened', { feature: 'notes' });
              setShowNotes(true);
            }
            if (id === 'music') {
              if (!showMusic) captureEvent('feature_opened', { feature: 'music' });
              setShowMusic(prev => !prev);
            }
            if (id === 'background' || id === 'cloud') {
              captureEvent('feature_opened', { feature: 'background' });
              setShowBackground(true);
            }
          }}
        />
        <FooterButtonsGroup
          buttons={FOOTER_BUTTONS_RIGHT}
          direction="right"
          onButtonClick={(id) => {
            if (id === 'user') {
              captureEvent('feature_opened', { feature: 'profile' });
              setShowProfile(true);
            }
            if (id === 'deepfocus') handleToggleDeepFocus();
            if (id === 'progress') {
              captureEvent('feature_opened', { feature: 'insights' });
              setShowFocusProfile(true);
            }
          }}
        />
      </footer>

      {!showOnboarding && !reflectionSessionId && <button type="button" className="product-feedback-button" aria-label={t("Góp ý sản phẩm")} onClick={() => setFeedbackForm({ initialKind: 'ux', entryPoint: 'feedback_button' })}>
        <MessageSquareText size={16} aria-hidden="true" /><span>{t("Góp ý")}</span>
      </button>}

      {/* SỬA: Truyền handleSettingsPresetChange */}
      {pipWindow && !pipWindow.closed && <TimerPictureInPicture
        pipWindow={pipWindow} scene={scene} minutes={minutes} seconds={seconds}
        isRunning={isRunning} isBreak={isBreakMode} onToggle={handleTimerToggle}
        onSkip={isBreakMode ? handleSkipBreakToPomodoro : handleSkipToBreak}
      />}

      {showSettings && (
        <SettingsModal
          onClose={handleCloseSettings}
          onPresetChange={handleSettingsPresetChange}
        />
      )}
      {showOnboarding && !reflectionSessionId && <OnboardingGuide
        onClose={() => setShowOnboarding(false)}
        settingsOpen={showSettings}
        onOpenSettings={handleOpenSettings}
        onCloseSettings={handleCloseSettings}
      />}
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
                onGiveFeedback={(reflection) => setFeedbackForm({ initialKind: 'ai', initialReflection: reflection, entryPoint: 'reflection_result' })}
                onClose={() => {
                  setReflectionSessionId(null);
                  localStorage.removeItem(PENDING_REFLECTION_KEY);
                }}
              />
      )}
      {feedbackForm && <React.Suspense fallback={<div className="product-feedback-loading" role="status">{t("Đang mở góp ý…")}<button type="button" onClick={() => setFeedbackForm(null)}>{t("Đóng")}</button></div>}>
        <FeedbackDialog {...feedbackForm} userId={currentUser?.id} onClose={() => setFeedbackForm(null)} />
      </React.Suspense>}
    </div>
  );
}
