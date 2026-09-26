import React from 'react'
import { Gamepad2, Trophy, Volume2, VolumeX, User, Sparkles } from 'lucide-react'
import { sounds } from '../utils/audio'

export default function Navbar({
  currentView,
  setCurrentView,
  user,
  onOpenAuth,
  isMuted,
  setIsMuted,
}) {
  const handleToggleSound = () => {
    const muted = sounds.toggleMute()
    setIsMuted(muted)
  }

  return (
    <header className="creamy-navbar-wrap">
      <div className="creamy-navbar">
        {/* Brand / Logo */}
        <div
          className="navbar-brand"
          onClick={() => setCurrentView('arena')}
          role="button"
          tabIndex={0}
        >
          {/* 3x3 Dots with Cut Line Icon Badge */}
          <div className="brand-badge-grid">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none" className="brand-grid-svg">
              <circle cx="6" cy="6" r="2.2" fill="#3B82F6" />
              <circle cx="14" cy="6" r="2.2" fill="#3B82F6" />
              <circle cx="22" cy="6" r="2.2" fill="#3B82F6" />
              <circle cx="6" cy="14" r="2.2" fill="#3B82F6" />
              <circle cx="14" cy="14" r="2.2" fill="#3B82F6" />
              <circle cx="22" cy="14" r="2.2" fill="#3B82F6" />
              <circle cx="6" cy="22" r="2.2" fill="#3B82F6" />
              <circle cx="14" cy="22" r="2.2" fill="#3B82F6" />
              <circle cx="22" cy="22" r="2.2" fill="#3B82F6" />
              <line x1="3" y1="9" x2="25" y2="3" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="3" y1="25" x2="25" y2="19" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>

          <div className="brand-text-wrap">
            <span className="brand-title">Poojyam Vettu</span>
            <span className="brand-accent-line" />
          </div>
        </div>

        {/* Right Section: Compact Icon Buttons & User Login Pill */}
        <div className="navbar-actions">
          {/* Arena Gamepad Button */}
          <button
            type="button"
            className={`nav-icon-circle ${currentView === 'arena' ? 'is-active' : ''}`}
            onClick={() => setCurrentView('arena')}
            title="Arena Games"
            aria-label="Arena Games"
          >
            <Gamepad2 size={18} />
          </button>

          {/* Leaderboard Trophy Button */}
          <button
            type="button"
            className={`nav-icon-circle ${currentView === 'leaderboard' ? 'is-active' : ''}`}
            onClick={() => setCurrentView('leaderboard')}
            title="Leaderboard"
            aria-label="Leaderboard"
          >
            <Trophy size={18} />
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            className="nav-icon-circle sound-icon-btn"
            onClick={handleToggleSound}
            title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            aria-label="Toggle Sound"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* User Profile Pill or Login CTA */}
          {user.isGuest ? (
            <button
              type="button"
              className="navbar-login-pill"
              onClick={onOpenAuth}
              aria-label="Login"
            >
              <User size={15} />
              <span>Login</span>
            </button>
          ) : (
            <div className="user-profile-pill" onClick={onOpenAuth} role="button">
              <img src={user.avatar} alt={user.username} className="profile-avatar" />
              <div className="profile-info-mini">
                <span className="profile-name">{user.username}</span>
                {user.points > 0 && (
                  <span className="profile-pts">
                    <Sparkles size={10} color="#D97706" />
                    {user.points}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

