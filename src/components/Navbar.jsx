import React from 'react'
import { Trophy, Volume2, VolumeX, LogIn, Sparkles, Gamepad2 } from 'lucide-react'
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
        {/* Main Bar: Brand, Desktop Nav, and Action Buttons */}
        <div className="navbar-main-row">
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

          {/* Desktop Navigation Tabs (Hidden on mobile; mobile uses dedicated full-width strip below) */}
          <nav className="navbar-nav desktop-nav">
            <button
              type="button"
              className={`nav-tab ${currentView === 'arena' ? 'is-active' : ''}`}
              onClick={() => setCurrentView('arena')}
            >
              <Gamepad2 size={17} />
              <span>Arena</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${currentView === 'leaderboard' ? 'is-active' : ''}`}
              onClick={() => setCurrentView('leaderboard')}
            >
              <Trophy size={17} />
              <span>Leaderboard</span>
              {!user.isGuest && user.points > 0 && (
                <span className="nav-point-badge">{user.points} pts</span>
              )}
            </button>
          </nav>

          {/* Right Action Icons: Sound and Profile/Login */}
          <div className="navbar-actions">
            <button
              type="button"
              className="sound-toggle-btn"
              onClick={handleToggleSound}
              title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
              aria-label="Toggle Sound"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {user.isGuest ? (
              <button
                type="button"
                className="user-login-cta"
                onClick={onOpenAuth}
              >
                <LogIn size={15} />
                <span>Login</span>
              </button>
            ) : (
              <div className="user-profile-pill" onClick={onOpenAuth} role="button">
                <img src={user.avatar} alt={user.username} className="profile-avatar" />
                <div className="profile-info">
                  <span className="profile-name">{user.username}</span>
                  <span className="profile-points">
                    <Sparkles size={11} color="#D97706" />
                    {user.points || 0} pts
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Strip (Guaranteed 100% visible on all mobile screens without any clipping) */}
        <div className="navbar-mobile-nav">
          <button
            type="button"
            className={`mobile-nav-pill ${currentView === 'arena' ? 'is-active' : ''}`}
            onClick={() => setCurrentView('arena')}
          >
            <Gamepad2 size={16} />
            <span>Arena</span>
          </button>

          <button
            type="button"
            className={`mobile-nav-pill ${currentView === 'leaderboard' ? 'is-active' : ''}`}
            onClick={() => setCurrentView('leaderboard')}
          >
            <Trophy size={16} />
            <span>Leaderboard</span>
            {!user.isGuest && user.points > 0 && (
              <span className="nav-point-badge">{user.points} pts</span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
