import React, { useState, useEffect, useRef } from 'react';
import './MusicModal.css';

const DEFAULT_TRACKS = [
  { id: 'jfKfPfyJRdk', title: 'Lofi Girl - Study Beats' },
  { id: '5qap5aO4i9A', title: 'Lofi Hip Hop Radio' },
  { id: 'tNkZsRw7hxg', title: 'Cozy Rain & Fireplace' },
  { id: 'Dx5_WhnQD2c', title: 'Rainy Cafe Ambience' },
];

export default function MusicModal({ isOpen, onClose, videoId, onUpdateVideoId }) {
  const [inputUrl, setInputUrl] = useState('');
  const [showInput, setShowInput] = useState(!videoId); // Show input if no videoId is playing
  const [viewMode, setViewMode] = useState('player'); // 'player' or 'saved'
  const [recentTracks, setRecentTracks] = useState(DEFAULT_TRACKS);
  const [syncWithRoom, setSyncWithRoom] = useState(false);
  const modalRef = useRef(null);

  // Helper to extract YouTube video ID from various URL formats
  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleApplyUrl = (e) => {
    if (e) e.preventDefault();
    const extractedId = getYouTubeId(inputUrl);
    if (extractedId) {
      onUpdateVideoId(extractedId);
      
      // Add custom track to recent list if not already there
      const isExist = recentTracks.some(t => t.id === extractedId);
      if (!isExist) {
        const newTrack = { id: extractedId, title: `Custom Video (${extractedId})` };
        setRecentTracks(prev => [newTrack, ...prev].slice(0, 8));
      }
      
      setInputUrl('');
      setShowInput(false);
    } else if (inputUrl.trim()) {
      alert('Invalid YouTube URL. Please enter a valid YouTube video link.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleApplyUrl();
    }
  };

  const selectTrack = (track) => {
    onUpdateVideoId(track.id);
    setViewMode('player'); // Switch back to player once selected
  };

  const deleteTrack = (e, trackId) => {
    e.stopPropagation();
    setRecentTracks(prev => prev.filter(t => t.id !== trackId));
  };

  // Click outside handler to hide modal without unmounting
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (isOpen && modalRef.current && !modalRef.current.contains(e.target)) {
        // Prevent closing when clicking on the footer or the music button itself to avoid conflicts
        const isFooterClick = e.target.closest('.timer-footer') || e.target.closest('.footer-btn');
        if (!isFooterClick) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isOpen, onClose]);

  return (
    <div 
      ref={modalRef}
      className={`music-popover ${isOpen ? '' : 'hidden'}`} 
      onClick={(e) => e.stopPropagation()}
    >
      
      {viewMode === 'player' ? (
        /* ================= PLAYER MODE ================= */
        <>
          {/* Header */}
          <div className="music-popover-header">
            <h3 className="music-popover-title">YouTube</h3>
            
            {showInput ? (
              /* Search Input State */
              <div className="music-input-wrapper">
                <input
                  type="text"
                  className="music-input"
                  placeholder="URL from YT, Spotify, Ap"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <button 
                  className="btn-music-action" 
                  onClick={handleApplyUrl}
                  title="Load Video"
                >
                  ✓
                </button>
                {videoId && (
                  <button 
                    className="btn-music-action btn-cancel-input" 
                    onClick={() => setShowInput(false)}
                    title="Cancel"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              /* Recent / Change Buttons State */
              <div className="music-header-buttons">
                <button 
                  className="btn-header-link"
                  onClick={() => setViewMode('saved')}
                >
                  <svg className="header-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Recent
                </button>
                <button 
                  className="btn-header-link"
                  onClick={() => setShowInput(true)}
                >
                  <svg className="header-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Video IFrame Container */}
          <div className="music-player-container">
            {videoId ? (
              <iframe
                key={videoId}
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`}
                title="YouTube study music player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="music-player-placeholder">
                <span className="placeholder-icon">🎵</span>
                <p>Paste a YouTube link above to play music</p>
              </div>
            )}
          </div>

          {/* Sync with Room Checkbox */}
          <label className="music-sync-container">
            <input
              type="checkbox"
              className="music-sync-checkbox"
              checked={syncWithRoom}
              onChange={(e) => setSyncWithRoom(e.target.checked)}
            />
            <span>Sync music with room</span>
          </label>
        </>
      ) : (
        /* ================= SAVED MUSIC MODE ================= */
        <>
          {/* Header */}
          <div className="music-popover-header">
            <h3 className="music-popover-title">Saved Music</h3>
            <button 
              className="btn-music-action btn-close-music" 
              onClick={() => setViewMode('player')}
              title="Back to Player"
            >
              ✕
            </button>
          </div>

          {/* Saved Tracks List */}
          <div className="saved-tracks-container scrollable-container">
            {recentTracks.length > 0 ? (
              recentTracks.map((track) => (
                <div 
                  key={track.id} 
                  className={`saved-track-row ${videoId === track.id ? 'current' : ''}`}
                  onClick={() => selectTrack(track)}
                >
                  {/* Video Thumbnail */}
                  <img 
                    src={`https://img.youtube.com/vi/${track.id}/default.jpg`} 
                    alt={track.title} 
                    className="saved-track-thumbnail" 
                  />
                  
                  {/* Track Title */}
                  <span className="saved-track-title">{track.title}</span>
                  
                  {/* Youtube Red Icon */}
                  <svg className="yt-brand-icon" viewBox="0 0 24 24" fill="#ff0000">
                    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.522 3.54 12 3.54 12 3.54s-7.522 0-9.388.515A3.003 3.003 0 0 0 .502 6.163C0 8.029 0 12 0 12s0 3.971.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.866.515 9.388.515 9.388.515s7.522 0 9.388-.515a3.003 3.003 0 0 0 2.11-2.108C24 15.971 24 12 24 12s0-3.971-.502-5.837z" />
                    <polygon points="9.545 8.568 15.818 12 9.545 15.432 9.545 8.568" fill="#fff" />
                  </svg>

                  {/* Actions */}
                  <div className="saved-track-actions">
                    <button 
                      className="btn-track-action btn-track-play" 
                      onClick={() => selectTrack(track)}
                      title="Play"
                    >
                      ✓
                    </button>
                    <button 
                      className="btn-track-action btn-track-delete" 
                      onClick={(e) => deleteTrack(e, track.id)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-saved-tracks">
                <span className="no-tracks-icon">📂</span>
                <p>No saved music tracks yet.</p>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
