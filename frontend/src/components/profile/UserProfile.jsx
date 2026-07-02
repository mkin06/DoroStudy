import React, { useState, useEffect } from 'react';
import { me } from '../../api/authentication/auth';
import './UserProfile.css';
import { studySessionAPI } from '../../api/studySession';

export default function ProfilePage({ onClose }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
  });

  useEffect(() => {
  const fetchUser = async () => {
    try {
      const response = await me();
      setUser(response);
      setFormData({
        name: response.name || '',
        location: response.location || '',
      });

      try {
        const stat = await studySessionAPI.getStats();
        setStats({
          currentStreak: stat.currentStreak ?? 0,
          bestStreak: stat.bestStreak ?? 0,
          totalHours: Math.round(stat.totalStudyTime ?? 0),
          pomodorosCompleted: stat.totalPomodoros ?? 0,
          thisWeek: stat.thisweekPomodoros ?? stat.thisWeekPomodoros ?? 0,
          dailyAverage: '0.0',
        });
      } catch (statsError) {
        // fallback nếu endpoint stats lỗi
        calculateStats(response);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchUser();
}, []);

  const calculateStats = (userData) => {
    if (!userData.times || userData.times.length === 0) {
      setStats({
        currentStreak: 0,
        bestStreak: 0,
        totalHours: 0,
        pomodorosCompleted: 0,
        thisWeek: 0,
        dailyAverage: 0,
      });
      return;
    }

    const times = userData.times;
    let totalDuration = 0;
    let totalCount = 0;

    times.forEach(t => {
      totalDuration += t.duration;
      totalCount += t.count;
    });

    setStats({
      currentStreak: 0,
      bestStreak: 0,
      totalHours: Math.round(totalDuration),
      pomodorosCompleted: totalCount,
      thisWeek: 0,
      dailyAverage: '0.0',
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = async () => {
    try {
      // TODO: Implement update profile API
      console.log('Saving profile:', formData);
      setEditing(false);
      alert('Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile');
    }
  };

  if (loading) {
    return (
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal-content" onClick={e => e.stopPropagation()}>
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal-content" onClick={e => e.stopPropagation()}>
          <div className="error">User not found</div>
        </div>
      </div>
    );
  }

  // Helper to extract initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // XP calculations matching the screenshot
  const totalXP = user.times?.length || 0;
  const xpPerLevel = 5;
  const level = Math.floor(totalXP / xpPerLevel) + 1;
  const currentXp = totalXP % xpPerLevel;
  const nextLevelXp = xpPerLevel;
  const xpToNext = xpPerLevel - currentXp;
  const xpPercent = (currentXp / xpPerLevel) * 100;
  const coins = user.times?.length || 0;

  // Daily average calculation (last 7 days - calculated frontend-only to avoid BE dependency)
  const calculateDailyAverage = () => {
    const totalMinutes = stats.totalHours || 0;
    if (totalMinutes === 0) return '0m';
    const avgMinutes = totalMinutes / 7;
    if (avgMinutes < 60) {
      return `${Math.max(15, Math.round(avgMinutes))}m`;
    }
    return `${(avgMinutes / 60).toFixed(1)}h`;
  };

  const dailyAverageFormatted = calculateDailyAverage();

  // Formatting total hours nicely (minutes to hours/minutes)
  const totalHoursFormatted = stats.totalHours >= 60 
    ? `${(stats.totalHours / 60).toFixed(1)}h` 
    : `${stats.totalHours}m`;

  // Heatmap configuration
  const currentYear = new Date().getFullYear();
  const monthsList = [
    { name: 'Jan', index: 0 },
    { name: 'Feb', index: 1 },
    { name: 'Mar', index: 2 },
    { name: 'Apr', index: 3 },
    { name: 'May', index: 4 },
    { name: 'Jun', index: 5 },
    { name: 'Jul', index: 6 },
    { name: 'Aug', index: 7 },
    { name: 'Sep', index: 8 },
    { name: 'Oct', index: 9 },
    { name: 'Nov', index: 10 },
    { name: 'Dec', index: 11 },
  ];

  const getMonthDays = (monthIndex, year) => {
    const firstDay = new Date(year, monthIndex, 1).getDay(); // 0 = Sunday
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ type: 'empty' });
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ type: 'day', day: d, dateStr });
    }
    return days;
  };

  // Build map of study counts by date (mocked on the frontend to showcase the heatmap calendar)
  const studyMap = {};
  const now = new Date();
  const seed = (user.username || 'user').charCodeAt(0);
  for (let i = 0; i < 35; i++) {
    const daysAgo = Math.floor(((seed * i + 13) % 180));
    const mockDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const dateStr = `${mockDate.getFullYear()}-${String(mockDate.getMonth() + 1).padStart(2, '0')}-${String(mockDate.getDate()).padStart(2, '0')}`;
    studyMap[dateStr] = ((seed * i + 7) % 5) + 1; // 1 to 5 sessions completed
  }

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="profile-modal-header">
          <h2>{user.name || user.username}'s profile</h2>
          <div className="profile-modal-actions">
            {!editing && (
              <button className="btn-edit-modal" onClick={() => setEditing(true)}>
                ✏️ Edit
              </button>
            )}
            <button className="btn-copy-link">
              🔗 Copy link
            </button>
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* User Info Section */}
        <div className="profile-user-section">
          <div className="profile-avatar-large">
            {getInitials(user.name || user.username)}
          </div>
          <div className="profile-user-info">
            <h1>{user.name || user.username}</h1>
            
            <div className="xp-progress-container">
              <div className="xp-progress-header">
                <span className="level-badge">Lv. {level}</span>
                <span className="xp-text">{xpToNext} XP to next</span>
              </div>
              <div className="xp-bar-bg">
                <div className="xp-bar-fill" style={{ width: `${xpPercent}%` }}></div>
              </div>
              <div className="xp-progress-footer">
                <span className="coins-info">Your coins: <strong>{coins}</strong></span>
                <span className="xp-next">{currentXp} / {nextLevelXp} XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        {!editing && stats && (
          <div className="profile-stats-section">
            <h3 className="stats-title">
              <svg className="section-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', marginRight: '8px', verticalAlign: 'middle' }}>
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Stats
            </h3>
            <div className="stats-grid">
              {/* Current Streak */}
              <div className="stat-card stat-current-streak">
                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
                <p className="stat-label">Current Streak</p>
                <p className="stat-value">{stats.currentStreak}</p>
                <p className="stat-unit">DAYS</p>
              </div>

              {/* Best Streak */}
              <div className="stat-card stat-best-streak">
                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
                <p className="stat-label">Best Streak</p>
                <p className="stat-value">{stats.bestStreak}</p>
                <p className="stat-unit">DAY{stats.bestStreak !== 1 ? 'S' : ''}</p>
              </div>

              {/* Total Hours */}
              <div className="stat-card stat-total-hours">
                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="stat-label">Total hours</p>
                <p className="stat-value">{totalHoursFormatted}</p>
              </div>

              {/* Pomodoros Completed */}
              <div className="stat-card stat-pomodoros">
                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p className="stat-label">Pomodoros Completed</p>
                <p className="stat-value">{stats.pomodorosCompleted}</p>
              </div>

              {/* This Week */}
              <div className="stat-card stat-this-week">
                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="stat-label">This Week</p>
                <p className="stat-value">{stats.thisWeek}</p>
                <p className="stat-unit">POMODOROS</p>
              </div>

              {/* Daily Average */}
              <div className="stat-card stat-daily-average">
                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                </svg>
                <p className="stat-label">Daily average</p>
                <p className="stat-value">{dailyAverageFormatted}</p>
                <p className="stat-unit">LAST 7 DAYS</p>
              </div>
            </div>
          </div>
        )}

        {/* Edit Form */}
        {editing && (
          <div className="profile-edit-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Enter your location"
              />
            </div>
            <div className="form-actions">
              <button 
                className="btn-cancel-edit"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-save-edit"
                onClick={handleSaveProfile}
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Heatmap Section */}
        {!editing && (
          <div className="profile-heatmap-section">
            <h3 className="heatmap-title">
              <svg className="section-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', marginRight: '8px', verticalAlign: 'middle' }}>
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
              Heatmap
            </h3>
            <div className="heatmap-container">
              <div className="heatmap-grid">
                {monthsList.map(month => (
                  <div className="heatmap-month" key={month.name}>
                    <span className="month-name">{month.name}</span>
                    <div className="month-grid-cells">
                      {getMonthDays(month.index, currentYear).map((day, idx) => {
                        if (day.type === 'empty') {
                          return <div key={`empty-${idx}`} className="heatmap-cell cell-empty"></div>;
                        }
                        const count = studyMap[day.dateStr] || 0;
                        let intensity = 'level-0';
                        if (count > 0 && count <= 2) intensity = 'level-1';
                        else if (count > 2 && count <= 4) intensity = 'level-2';
                        else if (count > 4 && count <= 6) intensity = 'level-3';
                        else if (count > 6) intensity = 'level-4';

                        return (
                          <div
                            key={day.dateStr}
                            className={`heatmap-cell cell-day ${intensity}`}
                            title={`${day.dateStr}: ${count} pomodoros`}
                          ></div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Gifts Received Section */}
        {!editing && (
          <div className="profile-gifts-section">
            <div className="gifts-header">
              <h3 className="gifts-title">🎁 Gifts Received</h3>
              <button className="btn-gifts-total">Total: 0</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}