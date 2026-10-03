import React, { useState, useEffect } from 'react';
import './SettingsModal.css';
import settingsTimerIcon from '../../assets/ground/clock.svg';
import settingsStopwatchIcon from '../../assets/ground/stopwatch.svg';
import settingsArrowUpIcon from '../../assets/settingModel/arrowup.svg';
import settingsDeepFocusIcon from '../../assets/ground/lightning.svg';

export const PRESETS = [
    { id: 1, name: 'Classic Pomodoro', focus: 25, short: 5, long: 15, deletable: false },
    { id: 2, name: 'Extended Focus', focus: 50, short: 10, long: 30, deletable: true },
    { id: 3, name: 'Quick Sessions', focus: 15, short: 3, long: 10, deletable: true },
    { id: 4, name: 'Deep Work', focus: 90, short: 15, long: 45, deletable: true }
];

export default function SettingsModal({
    onClose,
    onPresetChange,
    currentPresetObj,
    currentPresetTimes,
    timerMode = 'focus',
    onTimerModeChange,
    deepFocus = false,
    onToggleDeepFocus,
}) {
    const [activeTab, setActiveTab] = useState(timerMode);
    const [presets, setPresets] = useState(PRESETS);

    // Tìm preset khớp với preset hiện tại của người dùng
    const findMatchingPreset = () => {
        if (currentPresetObj) {
            return currentPresetObj;
        }
        if (currentPresetTimes && currentPresetTimes.length >= 3) {
            const match = presets.find(
                p => p.focus === currentPresetTimes[0] &&
                     p.short === currentPresetTimes[1] &&
                     p.long === currentPresetTimes[2]
            );
            if (match) return match;
            return {
                id: 'custom',
                name: 'Custom Preset',
                focus: currentPresetTimes[0],
                short: currentPresetTimes[1],
                long: currentPresetTimes[2],
                deletable: false,
            };
        }
        return presets[0];
    };

    const [selectedPreset, setSelectedPreset] = useState(findMatchingPreset);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customFocus, setCustomFocus] = useState(25);
    const [customShort, setCustomShort] = useState(5);
    const [customLong, setCustomLong] = useState(15);

    // Sync khi props thay đổi
    useEffect(() => {
        if (currentPresetObj) {
            setSelectedPreset(currentPresetObj);
        } else if (currentPresetTimes && currentPresetTimes.length >= 3) {
            const match = presets.find(
                p => p.focus === currentPresetTimes[0] &&
                     p.short === currentPresetTimes[1] &&
                     p.long === currentPresetTimes[2]
            );
            if (match) {
                setSelectedPreset(match);
            }
        }
    }, [currentPresetObj, currentPresetTimes, presets]);

    useEffect(() => {
        setActiveTab(timerMode);
    }, [timerMode]);

    const handleTabChange = (mode) => {
        setActiveTab(mode);
        onTimerModeChange?.(mode);
    };

    const handleSelectPreset = (preset) => {
        setSelectedPreset(preset);
        setShowDropdown(false);
        
        // Gửi thông tin về component cha
        if (onPresetChange) {
            onPresetChange({
                id: preset.id,
                preset: preset,
                focusTime: preset.focus,
                shortBreak: preset.short,
                longBreak: preset.long,
                presetName: preset.name
            });
        }
    };

    const handleDeletePreset = (e, presetId) => {
        e.stopPropagation();
        const updated = presets.filter(p => p.id !== presetId);
        setPresets(updated);
        if (selectedPreset.id === presetId) {
            handleSelectPreset(updated[0]);
        }
    };

    const handleCreateCustomPreset = (e) => {
        e.preventDefault();
        const name = customName.trim() || `Custom ${customFocus}/${customShort}`;
        const newPreset = {
            id: Date.now(),
            name,
            focus: Number(customFocus) || 25,
            short: Number(customShort) || 5,
            long: Number(customLong) || 15,
            deletable: true,
        };
        setPresets([...presets, newPreset]);
        handleSelectPreset(newPreset);
        setShowCustomForm(false);
        setCustomName('');
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>

                <div className="modal-tabs">
                    <button
                        type="button"
                        className={`modal-tab ${activeTab === 'focus' ? 'active' : ''}`}
                        onClick={() => handleTabChange('focus')}
                    >
                        <span className="tab-icon">
                            <img src={settingsTimerIcon} alt="" className="modal-icon-svg" width="18" height="18" />
                        </span>
                        Focus Timer
                    </button>
                    <button
                        type="button"
                        className={`modal-tab ${activeTab === 'stopwatch' ? 'active' : ''}`}
                        onClick={() => handleTabChange('stopwatch')}
                    >
                        <span className="tab-icon">
                            <img src={settingsStopwatchIcon} alt="" className="modal-icon-svg" width="18" height="18" />
                        </span>
                        Stopwatch
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'focus' ? (
                        <>
                            {/* Hiển thị thông tin preset hiện tại */}
                            <div className="preset-info-display">
                                <div className="preset-info-title">
                                    Current: {selectedPreset.name}
                                </div>
                                <div className="preset-info-details">
                                    Focus: {selectedPreset.focus}m • Break: {selectedPreset.short}m • Long: {selectedPreset.long}m
                                </div>
                            </div>

                            {/* Dropdown chọn preset */}
                            <div className="modal-row preset-row">
                                <label className="preset-label">Preset:</label>

                                <div className="preset-dropdown-container">
                                    <button
                                        type="button"
                                        className="preset-dropdown-trigger"
                                        onClick={() => setShowDropdown(!showDropdown)}
                                    >
                                        <span className="preset-name">{selectedPreset.name}</span>
                                        <span className="preset-time-inline">
                                            {selectedPreset.focus}m · {selectedPreset.short}m · {selectedPreset.long}m
                                        </span>
                                        <span className="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
                                    </button>

                                    {showDropdown && (
                                        <div className="preset-dropdown-menu">
                                            {presets.map(preset => {
                                                const isActive = (preset.id === selectedPreset.id) ||
                                                    (preset.name === selectedPreset.name &&
                                                     preset.focus === selectedPreset.focus &&
                                                     preset.short === selectedPreset.short);

                                                return (
                                                    <div
                                                        key={preset.id}
                                                        className={`preset-option ${isActive ? 'active' : ''}`}
                                                        onClick={() => handleSelectPreset(preset)}
                                                    >
                                                        <div className="preset-option-content">
                                                            <span className="preset-option-name">{preset.name}</span>
                                                            <span className="preset-option-time">
                                                                {preset.focus}m · {preset.short}m · {preset.long}m
                                                            </span>
                                                        </div>
                                                        {preset.deletable && (
                                                            <button
                                                                type="button"
                                                                className="preset-delete-btn"
                                                                onClick={(e) => handleDeletePreset(e, preset.id)}
                                                                title="Delete preset"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {!showCustomForm ? (
                                                <button
                                                    type="button"
                                                    className="preset-add-btn"
                                                    onClick={() => setShowCustomForm(true)}
                                                >
                                                    <span className="add-icon">+</span>
                                                    Add Custom Preset
                                                </button>
                                            ) : (
                                                <form className="custom-preset-form" onSubmit={handleCreateCustomPreset}>
                                                    <div className="custom-preset-title">Create Custom Preset</div>
                                                    <input
                                                        type="text"
                                                        placeholder="Preset name (e.g. My Sprint)"
                                                        value={customName}
                                                        onChange={(e) => setCustomName(e.target.value)}
                                                        className="custom-input"
                                                    />
                                                    <div className="custom-inputs-row">
                                                        <label>
                                                            <span>Focus</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="180"
                                                                value={customFocus}
                                                                onChange={(e) => setCustomFocus(e.target.value)}
                                                                className="custom-input-num"
                                                            />
                                                        </label>
                                                        <label>
                                                            <span>Break</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="60"
                                                                value={customShort}
                                                                onChange={(e) => setCustomShort(e.target.value)}
                                                                className="custom-input-num"
                                                            />
                                                        </label>
                                                        <label>
                                                            <span>Long</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="90"
                                                                value={customLong}
                                                                onChange={(e) => setCustomLong(e.target.value)}
                                                                className="custom-input-num"
                                                            />
                                                        </label>
                                                    </div>
                                                    <div className="custom-actions-row">
                                                        <button
                                                            type="button"
                                                            className="custom-cancel-btn"
                                                            onClick={() => setShowCustomForm(false)}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button type="submit" className="custom-save-btn">
                                                            Save Preset
                                                        </button>
                                                    </div>
                                                </form>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Toggle Count up timer (chuyển sang Stopwatch) */}
                            <div className="modal-row toggle-row">
                                <div className="toggle-item">
                                    <span className="toggle-icon">
                                        <img src={settingsArrowUpIcon} alt="" className="modal-icon-svg" width="18" height="18" />
                                    </span>
                                    <span>Count up timer</span>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={activeTab === 'stopwatch'}
                                        onChange={(e) => {
                                            const nextMode = e.target.checked ? 'stopwatch' : 'focus';
                                            handleTabChange(nextMode);
                                        }}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </>
                    ) : (
                        /* GIAO DIỆN STOPWATCH */
                        <div className="stopwatch-settings-card">
                            <div className="stopwatch-card-header">
                                <div className="stopwatch-card-icon-wrapper">
                                    <img src={settingsStopwatchIcon} alt="" className="stopwatch-icon-svg" width="22" height="22" />
                                </div>
                                <div>
                                    <h3 className="stopwatch-card-title">Chế độ Bấm giờ (Stopwatch)</h3>
                                    <p className="stopwatch-card-desc">
                                        Đếm thời gian xuôi từ 00:00. Thích hợp cho các buổi học tập trung tự do, không bị giới hạn hoặc ngắt quãng bởi chu kỳ nghỉ.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="stopwatch-apply-btn"
                                onClick={onClose}
                            >
                                Bắt đầu học với Bấm giờ
                            </button>
                        </div>
                    )}

                    {/* Toggle Deep Focus */}
                    <div className="modal-row toggle-row">
                        <div className="toggle-item">
                            <span className="toggle-icon">
                                <img src={settingsDeepFocusIcon} alt="" className="modal-icon-svg" width="18" height="18" />
                            </span>
                            <span>Deep Focus (Toàn màn hình)</span>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={deepFocus}
                                onChange={onToggleDeepFocus}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <p className="modal-info">
                        Requires studyfoc.us <a href="#" className="extension-link">Chrome extension</a>
                    </p>
                </div>
            </div>
        </div>
    );
}