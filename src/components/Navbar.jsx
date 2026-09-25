import React from 'react'
import { Trophy, Server, Volume2, VolumeX, LogIn, User, Sparkles } from 'lucide-react'
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
          <div className="brand-badge">
            <img src="/assets/vettu-x-red.png" alt="X" className="brand-x" />
            <img src="/assets/vettu-slot-filled.png" alt="O" className="brand-o" />
          </div>
          <div className="brand-text-wrap">
            <span className="brand-title">Poojyam Vettu</span>
            <span className="brand-malayalam">പൂജ്യം വെട്ട്</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="navbar-nav">
          <button
            type="button"
            className={`nav-tab ${currentView === 'arena' ? 'is-active' : ''}`}
            onClick={() => setCurrentView('arena')}
          >
            <span className="tab-icon">🎮</span>
            <span>Arena</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${currentView === 'leaderboard' ? 'is-active' : ''}`}
            onClick={() => setCurrentView('leaderboard')}
          >
            <Trophy size={17} className="tab-lucide" />
            <span>Leaderboard</span>
            {!user.isGuest && user.points > 0 && (
              <span className="nav-point-badge">{user.points} pts</span>
            )}
          </button>
        </nav>

        {/* Right Section: Sound Toggle & User Profile */}
        <div className="navbar-actions">
          {/* Sound Toggle */}
          <button
            type="button"
            className="sound-toggle-btn"
            onClick={handleToggleSound}
            title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            aria-label="Toggle Sound"
          >
            {isMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>

          {/* User Profile Pill */}
          {user.isGuest ? (
            <button
              type="button"
              className="user-login-cta"
              onClick={onOpenAuth}
            >
              <LogIn size={16} />
              <span>Login to Rank</span>
            </button>
          ) : (
            <div className="user-profile-pill" onClick={onOpenAuth} role="button">
              <img src={user.avatar} alt={user.username} className="profile-avatar" />
              <div className="profile-info">
                <span className="profile-name">{user.username}</span>
                <span className="profile-points">
                  <Sparkles size={12} color="#D97706" />
                  {user.points || 0} pts
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
