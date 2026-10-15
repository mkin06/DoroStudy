import { useLanguage } from '../../hooks/useLanguage';
import { translate as t } from '../../lib/locale';
import React, { useMemo, useState } from 'react';
import './SettingsModal.css';
import settingsTimerIcon from '../../assets/ground/clock.svg';
import { captureEvent } from '../../lib/analytics';

export const PRESETS = [
  { id: 'classic', name: 'Pomodoro cơ bản', focus: 25, short: 5, long: 15, deletable: false },
  { id: 'extended', name: 'Tập trung dài', focus: 50, short: 10, long: 30, deletable: false },
  { id: 'quick', name: 'Phiên học nhanh', focus: 15, short: 3, long: 10, deletable: false },
  { id: 'deep-work', name: 'Làm việc sâu', focus: 90, short: 15, long: 45, deletable: false },
];

const CUSTOM_PRESETS_KEY = 'dorostudy.customPresets';
const EMPTY_FORM = { name: '', focus: 25, short: 5, long: 15 };

function loadCustomPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export default function SettingsModal({ onClose, onPresetChange }) {
  useLanguage();
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [showDropdown, setShowDropdown] = useState(true);
  const [customPresets, setCustomPresets] = useState(loadCustomPresets);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const presets = useMemo(() => [...PRESETS, ...customPresets], [customPresets]);

  const applyPreset = (preset) => {
    setSelectedPreset(preset);
    setShowDropdown(false);
    onPresetChange?.({
      focusTime: preset.focus,
      shortBreak: preset.short,
      longBreak: preset.long,
      presetName: preset.name,
    });
  };

  const deletePreset = (event, presetId) => {
    event.stopPropagation();
    const deleted = customPresets.find((preset) => preset.id === presetId);
    const next = customPresets.filter((preset) => preset.id !== presetId);
    setCustomPresets(next);
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(next));
    if (deleted) {
      captureEvent('custom_preset_deleted', {
        focus_minutes: deleted.focus,
        short_break_minutes: deleted.short,
        long_break_minutes: deleted.long,
      });
    }
    if (selectedPreset.id === presetId) setSelectedPreset(PRESETS[0]);
  };

  const updateNumber = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const createPreset = (event) => {
    event.preventDefault();
    setError('');
    const name = form.name.trim();
    const focus = Number(form.focus);
    const short = Number(form.short);
    const long = Number(form.long);
    if (!name) {
      setError(t("Vui lòng đặt tên cho bộ thời gian."));
      return;
    }
    if ([focus, short, long].some((value) => !Number.isInteger(value) || value < 1 || value > 180)) {
      setError(t("Mỗi khoảng thời gian phải là số nguyên từ 1 đến 180 phút."));
      return;
    }

    const preset = {
      id: `custom-${Date.now()}`,
      name: name.slice(0, 50),
      focus,
      short,
      long,
      deletable: true,
    };
    const next = [...customPresets, preset];
    setCustomPresets(next);
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(next));
    captureEvent('custom_preset_created', {
      focus_minutes: focus,
      short_break_minutes: short,
      long_break_minutes: long,
    });
    setForm(EMPTY_FORM);
    setShowCreateForm(false);
    applyPreset(preset);
  };

  return (
    <div className="modal-backdrop timer-settings-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="timer-settings-title">
        <button className="modal-close" onClick={onClose} aria-label={t("Đóng")}>✕</button>

        <div className="modal-tabs">
          <div className="modal-tab active" id="timer-settings-title">
            <span className="tab-icon">
              <img src={settingsTimerIcon} alt="" className="modal-icon-svg" width="18" height="18" />
            </span>{t("Cài đặt thời gian")}</div>
        </div>

        <div className="modal-body">
          <div className="preset-info-display">
            <div className="preset-info-title">{t("Đang chọn:")} {t(selectedPreset.name)}</div>
            <div className="preset-info-details">{t("Tập trung")} {selectedPreset.focus} {t("phút · Nghỉ ngắn")} {selectedPreset.short} {t("phút · Nghỉ dài")} {selectedPreset.long} {t("phút")}</div>
          </div>

          <div className="modal-row preset-row">
            <label className="preset-label">{t("Bộ thời gian")}</label>
            <div className="preset-dropdown-container">
              <button type="button" className="preset-dropdown-trigger"
                onClick={() => setShowDropdown((open) => !open)} aria-expanded={showDropdown}>
                <span className="preset-name">{t(selectedPreset.name)}</span>
                <span className="preset-time-inline">
                  {selectedPreset.focus}p · {selectedPreset.short}p · {selectedPreset.long}p
                </span>
                <span className="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
              </button>

              {showDropdown && (
                <div className="preset-dropdown-menu">
                  {presets.map((preset) => (
                    <div key={preset.id} role="button" tabIndex={0}
                      className={`preset-option ${preset.id === selectedPreset.id ? 'active' : ''}`}
                      onClick={() => applyPreset(preset)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') applyPreset(preset);
                      }}>
                      <span className="preset-option-content">
                        <span className="preset-option-name">{t(preset.name)}</span>
                        <span className="preset-option-time">
                          {preset.focus}p · {preset.short}p · {preset.long}p
                        </span>
                      </span>
                      {preset.deletable && (
                        <button type="button" className="preset-delete-btn"
                          onClick={(event) => deletePreset(event, preset.id)}
                          onKeyDown={(event) => event.stopPropagation()}
                          title={t("Xóa bộ thời gian")}>✕</button>
                      )}
                    </div>
                  ))}

                  <button type="button" className="preset-add-btn" data-tour="custom-preset"
                    onClick={() => { setShowCreateForm(true); setShowDropdown(false); }}>
                    <span className="add-icon" aria-hidden="true">+</span>{t("Tạo bộ thời gian riêng")}</button>
                </div>
              )}
            </div>
          </div>

          {showCreateForm && (
            <form className="custom-preset-form" data-tour="custom-preset" onSubmit={createPreset}>
              <h3>{t("Tạo bộ thời gian riêng")}</h3>
              {error && <p className="custom-preset-error" role="alert">{t(error)}</p>}
              <label>{t("Tên bộ thời gian")}<input value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  maxLength={50} placeholder={t("Ví dụ: Ôn thi buổi tối")} autoFocus required />
              </label>
              <div className="custom-preset-grid">
                <label>{t("Tập trung (phút)")}<input type="number" min="1" max="180" step="1" value={form.focus} onChange={updateNumber('focus')} required />
                </label>
                <label>{t("Nghỉ ngắn (phút)")}<input type="number" min="1" max="180" step="1" value={form.short} onChange={updateNumber('short')} required />
                </label>
                <label>{t("Nghỉ dài (phút)")}<input type="number" min="1" max="180" step="1" value={form.long} onChange={updateNumber('long')} required />
                </label>
              </div>
              <div className="custom-preset-actions">
                <button type="button" onClick={() => { setShowCreateForm(false); setShowDropdown(true); setError(''); }}>{t("Hủy")}</button>
                <button type="submit">{t("Lưu và sử dụng")}</button>
              </div>
            </form>
          )}

          <p className="modal-info">{t("Bộ thời gian riêng được lưu trên trình duyệt này và có thể xóa bất cứ lúc nào.")}</p>
        </div>
      </div>
    </div>
  );
}
