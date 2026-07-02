import React, { useState } from 'react';
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

export default function SettingsModal({ onClose, onPresetChange }) {
    const [activeTab, setActiveTab] = useState('focus');
    const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [presets, setPresets] = useState(PRESETS);
    const [countUpTimer, setCountUpTimer] = useState(false);
    const [deepFocus, setDeepFocus] = useState(false);

    const handleSelectPreset = (preset) => {
        setSelectedPreset(preset);
        setShowDropdown(false);
        
        // Gửi thông tin về component cha
        if (onPresetChange) {
            onPresetChange({
                focusTime: preset.focus,
                shortBreak: preset.short,
                longBreak: preset.long,
                presetName: preset.name
            });
        }
    };

    const handleDeletePreset = (e, presetId) => {
        e.stopPropagation();
        setPresets(presets.filter(p => p.id !== presetId));
        if (selectedPreset.id === presetId) {
            setSelectedPreset(presets[0]);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>

                <div className="modal-tabs">
                    <button
                        className={`modal-tab ${activeTab === 'focus' ? 'active' : ''}`}
                        onClick={() => setActiveTab('focus')}
                    >
                        <span className="tab-icon">
                            <img src={settingsTimerIcon} alt="" className="modal-icon-svg" width="18" height="18" />
                        </span>
                        Focus Timer
                    </button>
                    <button
                        className={`modal-tab ${activeTab === 'stopwatch' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stopwatch')}
                    >
                        <span className="tab-icon">
                            <img src={settingsStopwatchIcon} alt="" className="modal-icon-svg" width="18" height="18" />
                        </span>
                        Stopwatch
                    </button>
                </div>

                <div className="modal-body">
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
                                className="preset-dropdown-trigger"
                                onClick={() => setShowDropdown(!showDropdown)}
                            >
                                <span className="preset-name">{selectedPreset.name}</span>
                                <span className="preset-time-inline">
                                    {selectedPreset.focus}m · {selectedPreset.short}m · {selectedPreset.long}m
                                </span>
                                <span className="dropdown-arrow">▲</span>
                            </button>

                            {showDropdown && (
                                <div className="preset-dropdown-menu">
                                    {presets.map(preset => (
                                        <div
                                            key={preset.id}
                                            className={`preset-option ${preset.id === selectedPreset.id ? 'active' : ''}`}
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
                                                    className="preset-delete-btn"
                                                    onClick={(e) => handleDeletePreset(e, preset.id)}
                                                    title="Delete preset"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                    <button className="preset-add-btn">
                                        <span className="add-icon">+</span>
                                        Add Custom Preset
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Toggle Count up timer */}
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
                                checked={countUpTimer}
                                onChange={(e) => setCountUpTimer(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {/* Toggle Deep Focus */}
                    <div className="modal-row toggle-row">
                        <div className="toggle-item">
                            <span className="toggle-icon">
                                <img src={settingsDeepFocusIcon} alt="" className="modal-icon-svg" width="18" height="18" />
                            </span>
                            <span>Deep Focus</span>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={deepFocus}
                                onChange={(e) => setDeepFocus(e.target.checked)}
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