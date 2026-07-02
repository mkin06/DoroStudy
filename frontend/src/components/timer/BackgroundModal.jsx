import React, { useState } from 'react';
import './BackgroundModal.css';

const MOTION_PRESETS = [
  {
    id: 'cafe-motion',
    name: 'Cozy Cafe',
    type: 'video',
    thumbnail: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&auto=format&fit=crop',
    url: 'https://assets.codepen.io/6093409/rain.mp4',
  },
  {
    id: 'forest-motion',
    name: 'Cozy Campfire',
    type: 'video',
    thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&auto=format&fit=crop',
    url: 'https://assets.codepen.io/6093409/campfire.mp4',
  },
  {
    id: 'beach-motion',
    name: 'Sandy Beach',
    type: 'video',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop',
    url: 'https://assets.codepen.io/6093409/waves.mp4',
  },
  {
    id: 'river-motion',
    name: 'Forest Stream',
    type: 'video',
    thumbnail: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&auto=format&fit=crop',
    url: 'https://assets.codepen.io/6093409/river.mp4',
  },
];

const STILL_PRESETS = [
  {
    id: 'cafe-still',
    name: 'Cozy Cafe',
    type: 'image',
    thumbnail: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&auto=format&fit=crop',
    url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1600&auto=format&fit=crop',
  },
  {
    id: 'forest-still',
    name: 'Sunlit Forest',
    type: 'image',
    thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&auto=format&fit=crop',
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&auto=format&fit=crop',
  },
  {
    id: 'beach-still',
    name: 'Sandy Beach',
    type: 'image',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&auto=format&fit=crop',
  },
  {
    id: 'bar-still',
    name: 'Cozy Bar',
    type: 'image',
    thumbnail: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&auto=format&fit=crop',
    url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600&auto=format&fit=crop',
  },
];

const WEATHER_PRESETS = [
  { id: 'clear', name: 'Clear Day', label: '☀️ Clear' },
  { id: 'rain', name: 'Rainy Scene', label: '🌧️ Rainy' },
  { id: 'snow', name: 'Snowy Season', label: '❄️ Snowy' },
  { id: 'storm', name: 'Thunderstorm', label: '⚡ Stormy' },
];

export default function BackgroundModal({ onClose, scene, onChangeScene }) {
  const [category, setCategory] = useState('background'); // 'background' or 'weather'
  const [subTab, setSubTab] = useState('motion'); // 'motion', 'stills', 'personalize'
  const [customUrl, setCustomUrl] = useState('');
  const [customType, setCustomType] = useState('image'); // 'image' or 'video'

  const handleOpacityChange = (e) => {
    const opacity = parseFloat(e.target.value);
    onChangeScene({ ...scene, opacity });
  };

  const selectPreset = (preset) => {
    onChangeScene({
      ...scene,
      type: preset.type,
      url: preset.url,
      id: preset.id,
    });
  };

  const selectWeather = (weatherId) => {
    onChangeScene({
      ...scene,
      weather: weatherId,
    });
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    onChangeScene({
      ...scene,
      type: customType,
      url: customUrl,
      id: 'custom',
    });
  };

  return (
    <div className="background-modal-backdrop" onClick={onClose}>
      <div className="background-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="background-modal-header">
          <h2>Set your focus scene</h2>
          <div className="background-modal-header-actions">
            
            {/* Opacity slider */}
            <div className="opacity-slider-container">
              <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                value={scene.opacity}
                onChange={handleOpacityChange}
                className="brightness-range"
              />
            </div>
            
            <button className="btn-close-scene" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Category Selector (Background / Weather) */}
        <div className="category-selector-container">
          <div className="category-selector">
            <button
              className={`btn-category ${category === 'background' ? 'active' : ''}`}
              onClick={() => setCategory('background')}
            >
              <span className="btn-category-icon">🖼️</span> Background
            </button>
            <button
              className={`btn-category ${category === 'weather' ? 'active' : ''}`}
              onClick={() => setCategory('weather')}
            >
              <span className="btn-category-icon">🌧️</span> Weather
            </button>
          </div>
        </div>

        {/* Render Tab Contents */}
        {category === 'background' ? (
          <>
            {/* Background Subtabs */}
            <div className="scene-subtabs">
              <button
                className={`btn-subtab ${subTab === 'motion' ? 'active' : ''}`}
                onClick={() => setSubTab('motion')}
              >
                Motion
              </button>
              <button
                className={`btn-subtab ${subTab === 'stills' ? 'active' : ''}`}
                onClick={() => setSubTab('stills')}
              >
                Stills
              </button>
              <button
                className={`btn-subtab ${subTab === 'personalize' ? 'active' : ''}`}
                onClick={() => setSubTab('personalize')}
              >
                Personalize
              </button>
            </div>

            {/* Grid display for Motion/Stills */}
            {subTab === 'motion' && (
              <div className="scene-grid scrollable-container">
                {MOTION_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    className={`scene-card ${scene.url === preset.url ? 'active' : ''}`}
                    onClick={() => selectPreset(preset)}
                  >
                    <img src={preset.thumbnail} alt={preset.name} className="scene-thumbnail" />
                    <div className="play-button-overlay">
                      <svg className="play-icon-svg" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <span className="scene-name">{preset.name}</span>
                    {scene.url === preset.url && <div className="active-badge">✓</div>}
                  </div>
                ))}
              </div>
            )}

            {subTab === 'stills' && (
              <div className="scene-grid scrollable-container">
                {STILL_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    className={`scene-card ${scene.url === preset.url ? 'active' : ''}`}
                    onClick={() => selectPreset(preset)}
                  >
                    <img src={preset.thumbnail} alt={preset.name} className="scene-thumbnail" />
                    <span className="scene-name">{preset.name}</span>
                    {scene.url === preset.url && <div className="active-badge">✓</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Personalize (Custom URL input) */}
            {subTab === 'personalize' && (
              <form onSubmit={handleApplyCustom} className="personalize-form">
                <p className="personalize-desc">Paste a direct image or video link (MP4) to set your custom background scene.</p>
                <div className="form-group-scene">
                  <label>Background URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/background.jpg"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group-scene">
                  <label>Background Type</label>
                  <div className="custom-type-selector">
                    <label>
                      <input
                        type="radio"
                        name="custom-type"
                        value="image"
                        checked={customType === 'image'}
                        onChange={() => setCustomType('image')}
                      />
                      <span>Static Image</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="custom-type"
                        value="video"
                        checked={customType === 'video'}
                        onChange={() => setCustomType('video')}
                      />
                      <span>Looping Video</span>
                    </label>
                  </div>
                </div>
                <button type="submit" className="btn-apply-custom">Apply Custom Scene</button>
              </form>
            )}
          </>
        ) : (
          /* Weather Presets Grid */
          <div className="weather-grid">
            {WEATHER_PRESETS.map((weather) => (
              <button
                key={weather.id}
                className={`weather-card ${scene.weather === weather.id ? 'active' : ''}`}
                onClick={() => selectWeather(weather.id)}
              >
                <span className="weather-card-label">{weather.label}</span>
                <span className="weather-card-name">{weather.name}</span>
                {scene.weather === weather.id && <div className="active-badge">✓</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
