import { useLanguage } from '../../hooks/useLanguage';
import { translate as t } from '../../lib/locale';
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, Copy, Flame, MapPin, Target, X } from 'lucide-react';
import { me } from '../../api/authentication/auth';
import { studySessionAPI } from '../../api/studySession';
import './UserProfile.css';

const RANGE_OPTIONS = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
];

const dateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatMinutes = (minutes = 0) => {
  if (minutes < 60) return t("{0} phút", [Math.round(minutes)]);
  const hours = minutes / 60;
  return t("{0} giờ", [hours >= 10 ? Math.round(hours) : hours.toFixed(1)]);
};

const startOfWeek = (value) => {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

export default function ProfilePage({ onClose }) {
  const { language } = useLanguage();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('month');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([me(), studySessionAPI.getStats(), studySessionAPI.getAllSessions(60)])
      .then(([profile, summary, history]) => {
        if (!active) return;
        setUser(profile);
        setStats(summary);
        setSessions(Array.isArray(history) ? history : []);
      })
      .catch((error) => console.error('Failed to load profile:', error))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const activity = useMemo(() => {
    const map = new Map();
    for (const session of sessions) {
      const when = session.startTime || session.createdAt;
      if (!when) continue;
      const key = dateKey(when);
      const current = map.get(key) || { sessions: 0, minutes: 0 };
      current.sessions += session.count || 1;
      current.minutes += session.duration || 0;
      map.set(key, current);
    }
    return map;
  }, [sessions]);

  const chart = useMemo(() => {
    const now = new Date();
    if (range === 'day') {
      return Array.from({ length: 14 }, (_, index) => {
        const date = new Date(now);
        date.setDate(now.getDate() - (13 - index));
        const value = activity.get(dateKey(date)) || { sessions: 0, minutes: 0 };
        return { key: dateKey(date), label: date.toLocaleDateString(language === 'en' ? 'en-US' : 'vi-VN', { weekday: 'short', day: '2-digit' }), ...value };
      });
    }
    if (range === 'week') {
      return Array.from({ length: 8 }, (_, index) => {
        const start = startOfWeek(now);
        start.setDate(start.getDate() - (7 - index) * 7);
        let sessionCount = 0;
        let minutes = 0;
        for (let offset = 0; offset < 7; offset += 1) {
          const day = new Date(start);
          day.setDate(start.getDate() + offset);
          const value = activity.get(dateKey(day));
          sessionCount += value?.sessions || 0;
          minutes += value?.minutes || 0;
        }
        return { key: dateKey(start), label: `${start.getDate()}/${start.getMonth() + 1}`, sessions: sessionCount, minutes };
      });
    }

    const year = now.getFullYear();
    const month = now.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, (_, index) => ({ key: `blank-${index}`, blank: true })),
      ...Array.from({ length: days }, (_, index) => {
        const date = new Date(year, month, index + 1);
        return { key: dateKey(date), label: index + 1, ...(activity.get(dateKey(date)) || { sessions: 0, minutes: 0 }) };
      }),
    ];
  }, [activity, range, language]);

  const maxMinutes = Math.max(1, ...chart.map((item) => item.minutes || 0));
  const initials = (user?.name || user?.username || 'U').trim().split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase();
  const joined = user?.createdAt ? new Date(user.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'vi-VN', { month: 'long', year: 'numeric' }) : null;
  const last30Minutes = sessions.reduce((total, session) => {
    const when = session.startTime || session.createdAt;
    return when && Date.now() - new Date(when).getTime() <= 30 * 86400000 ? total + (session.duration || 0) : total;
  }, 0);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (loading || !user || !stats) {
    return (
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal-content profile-loading" onClick={(event) => event.stopPropagation()}>
          <span className="profile-loader" />{t("Đang tải hồ sơ…")}</div>
      </div>
    );
  }

  const statCards = [
    { icon: Flame, value: stats.currentStreak || 0, label: t("Chuỗi hiện tại"), unit: t("ngày") },
    { icon: Target, value: stats.totalPomodoros || 0, label: t("Phiên hoàn thành"), unit: t("phiên") },
    { icon: Clock3, value: formatMinutes(stats.totalStudyTime || 0), label: t("Tổng tập trung") },
    { icon: CalendarDays, value: formatMinutes(last30Minutes / 30), label: t("Trung bình mỗi ngày"), unit: t("30 ngày qua") },
  ];

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <main className="profile-modal-content" onClick={(event) => event.stopPropagation()}>
        <header className="profile-topbar">
          <span className="profile-kicker">{t("Hồ sơ học tập")}</span>
          <div className="profile-actions">
            <button type="button" className="profile-copy" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t("Đã sao chép") : t("Chia sẻ")}
            </button>
            <button type="button" className="profile-close" onClick={onClose} aria-label={t("Đóng")}><X size={19} /></button>
          </div>
        </header>

        <section className="profile-identity">
          <div className="profile-avatar-large">
            {user.image ? <img src={user.image} alt="" /> : initials}
          </div>
          <div>
            <h1>{user.name || user.username}</h1>
            <p className="profile-handle">@{user.username}</p>
            <div className="profile-meta">
              {user.location && <span><MapPin size={14} />{user.location}</span>}
              {joined && <span><CalendarDays size={14} />Tham gia {joined}</span>}
            </div>
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-section-heading">
            <div><p className="profile-eyebrow">{t("Tổng quan")}</p><h2>{t("Tiến trình của bạn")}</h2></div>
            <span className="profile-best">{t("Kỷ lục")}{stats.bestStreak || 0}{t("ngày")}</span>
          </div>
          <div className="stats-grid">
            {statCards.map(({ icon: Icon, value, label, unit }) => (
              <article className="stat-card" key={label}>
                <span className="stat-icon"><Icon size={18} /></span>
                <strong>{value}</strong>
                <p>{t(label)}</p>
                {unit && <small>{unit}</small>}
              </article>
            ))}
          </div>
        </section>

        <section className="profile-section activity-section">
          <div className="profile-section-heading activity-heading">
            <div><p className="profile-eyebrow">{t("Nhịp học")}</p><h2>{range === 'month' ? t("Tháng này") : range === 'week' ? t("8 tuần gần đây") : t("14 ngày gần đây")}</h2></div>
            <div className="range-tabs" role="tablist" aria-label={t("Khoảng thời gian")}>
              {RANGE_OPTIONS.map((option) => (
                <button key={option.id} type="button" className={range === option.id ? 'active' : ''} onClick={() => setRange(option.id)}>{t(option.label)}</button>
              ))}
            </div>
          </div>

          {range === 'month' ? (
            <>
              <div className="calendar-weekdays">{(language === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']).map(day => <span key={day}>{day}</span>)}</div>
              <div className="activity-calendar">
                {chart.map((item) => item.blank ? <span key={item.key} /> : (
                  <div key={item.key} className={`calendar-day level-${Math.min(4, item.sessions)}`} title={t("{0}: {1} phiên · {2}", [item.label, item.sessions, formatMinutes(item.minutes)])}>
                    <span>{item.label}</span>{item.sessions > 0 && <i />}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={`activity-bars ${range === 'week' ? 'weekly' : ''}`}>
              {chart.map((item) => (
                <div className="activity-bar-item" key={item.key} title={t("{0} phiên · {1}", [item.sessions, formatMinutes(item.minutes)])}>
                  <div className="activity-bar-track"><span style={{ height: `${Math.max(item.minutes ? 8 : 2, (item.minutes / maxMinutes) * 100)}%` }} /></div>
                  <strong>{item.sessions}</strong><small>{item.label}</small>
                </div>
              ))}
            </div>
          )}
          <p className="activity-caption">{t("Mỗi cột hoặc ô thể hiện số phiên và thời gian bạn thực sự đã học.")}</p>
        </section>
      </main>
    </div>
  );
}
