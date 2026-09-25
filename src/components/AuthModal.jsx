import React, { useState } from 'react'
import { X, Trophy, Sparkles, Check, UserCheck, Shield } from 'lucide-react'
import { DEFAULT_AVATARS, saveUser } from '../utils/userStore'

export default function AuthModal({ isOpen, onClose, user, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState(user.isGuest ? 'login' : 'edit')
  const [username, setUsername] = useState(user.username || '')
  const [email, setEmail] = useState(user.email || '')
  const [password, setPassword] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar || DEFAULT_AVATARS[0].src)
  const [successMsg, setSuccessMsg] = useState('')

  if (!isOpen) return null

  const handleLoginSubmit = (e) => {
    e.preventDefault()
    if (!username.trim()) return

    const updated = {
      ...user,
      id: user.id.startsWith('usr_') ? user.id : `usr_${Math.floor(10000 + Math.random() * 90000)}`,
      username: username.trim(),
      email: email.trim() || `${username.toLowerCase()}@player.com`,
      avatar: selectedAvatar,
      isGuest: false,
      points: user.points || 120, // initial rating boost for logging in
      badge: user.points >= 250 ? 'Platinum' : 'Gold',
    }

    saveUser(updated)
    onUserUpdated(updated)
    setSuccessMsg('Logged in successfully! You are now eligible for the Weekly Leaderboard.')
    setTimeout(() => {
      setSuccessMsg('')
      onClose()
    }, 1200)
  }

  const handleGuestSave = (e) => {
    e.preventDefault()
    if (!username.trim()) return

    const updated = {
      ...user,
      username: username.trim(),
      avatar: selectedAvatar,
    }

    saveUser(updated)
    onUserUpdated(updated)
    setSuccessMsg('Guest profile updated!')
    setTimeout(() => {
      setSuccessMsg('')
      onClose()
    }, 800)
  }

  const handleQuickDemoLogin = () => {
    const demoUser = {
      id: 'usr_aswin_dev',
      username: 'Aswin_Pro',
      email: 'aswin@game.dev',
      avatar: '/assets/aswin-avatar.png',
      isGuest: false,
      wins: 16,
      losses: 3,
      points: 420,
      streak: 4,
      badge: 'Diamond',
    }
    saveUser(demoUser)
    onUserUpdated(demoUser)
    setSuccessMsg('Logged in as Aswin_Pro! Leaderboard points enabled.')
    setTimeout(() => {
      setSuccessMsg('')
      onClose()
    }, 1000)
  }

  const handleLogout = () => {
    const guestUser = {
      id: `guest_${Math.floor(1000 + Math.random() * 9000)}`,
      username: `Guest_${Math.floor(1000 + Math.random() * 9000)}`,
      isGuest: true,
      avatar: '/assets/aswin-avatar.png',
      wins: 0,
      losses: 0,
      points: 0,
      streak: 0,
      badge: 'Novice',
    }
    saveUser(guestUser)
    onUserUpdated(guestUser)
    setSuccessMsg('Logged out. Switched to Guest Mode.')
    setTimeout(() => {
      setSuccessMsg('')
      onClose()
    }, 900)
  }

  return (
    <div className="creamy-modal-overlay" onClick={onClose}>
      <div className="creamy-modal-content auth-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button type="button" className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="auth-header">
          <div className="auth-icon-badge">
            <Trophy size={28} color="#D97706" />
          </div>
          <h2 className="auth-title">
            {user.isGuest ? 'Join the Poojyam Arena' : 'Player Profile'}
          </h2>
          <p className="auth-subtitle">
            {user.isGuest
              ? 'Log in to record your 1v1 wins and climb the Weekly Leaderboard!'
              : 'Logged in and tracking weekly leaderboard wins.'}
          </p>
        </div>

        {/* Tab switchers if guest */}
        {user.isGuest ? (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'login' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Log In / Register
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'guest' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('guest')}
            >
              Guest Settings
            </button>
          </div>
        ) : null}

        {successMsg && (
          <div className="auth-alert-success">
            <Check size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Avatar Picker */}
        <div className="avatar-selector-section">
          <label className="auth-label">Choose Avatar</label>
          <div className="avatar-grid">
            {DEFAULT_AVATARS.map((av) => (
              <button
                key={av.id}
                type="button"
                className={`avatar-option-btn ${selectedAvatar === av.src ? 'is-selected' : ''}`}
                onClick={() => setSelectedAvatar(av.src)}
              >
                <img src={av.src} alt={av.name} />
                {selectedAvatar === av.src && (
                  <div className="avatar-check">
                    <Check size={12} color="#FFF" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        {user.isGuest && activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="form-group">
              <label className="auth-label">Player Username</label>
              <input
                type="text"
                className="creamy-input"
                placeholder="e.g. Rahul_Kochi or Aswin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="auth-label">Email (Optional)</label>
              <input
                type="email"
                className="creamy-input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="auth-label">Password</label>
              <input
                type="password"
                className="creamy-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="auth-perks-box">
              <Sparkles size={16} color="#D97706" />
              <span>
                <strong>Leaderboard Qualification:</strong> Logged-in players earn{' '}
                <strong>+25 points</strong> per online 1v1 win!
              </span>
            </div>

            <button type="submit" className="creamy-btn btn-primary auth-submit-btn">
              <UserCheck size={18} />
              <span>Log In & Activate Leaderboard</span>
            </button>

            <button
              type="button"
              className="demo-login-quick"
              onClick={handleQuickDemoLogin}
            >
              ⚡ Instant 1-Click Demo Login (Aswin_Pro)
            </button>
          </form>
        )}

        {user.isGuest && activeTab === 'guest' && (
          <form onSubmit={handleGuestSave} className="auth-form">
            <div className="form-group">
              <label className="auth-label">Guest Handle</label>
              <input
                type="text"
                className="creamy-input"
                placeholder="Guest Nickname"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <p className="guest-note">
              Note: Guest wins will be saved on your browser, but you will not appear on the official Weekly Leaderboard until you log in.
            </p>

            <button type="submit" className="creamy-btn auth-submit-btn">
              Save Guest Profile
            </button>
          </form>
        )}

        {!user.isGuest && (
          <div className="logged-in-profile-view">
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-num">{user.points || 0}</span>
                <span className="stat-label">Rating Points</span>
              </div>
              <div className="stat-card">
                <span className="stat-num">{user.wins || 0}</span>
                <span className="stat-label">Total Wins</span>
              </div>
              <div className="stat-card">
                <span className="stat-num">{user.streak || 0} 🔥</span>
                <span className="stat-label">Win Streak</span>
              </div>
            </div>

            <div className="user-badge-display">
              <Shield size={18} color="#2563EB" />
              <span>Current Tier: <strong>{user.badge || 'Gold'}</strong></span>
            </div>

            <button
              type="button"
              className="creamy-btn auth-logout-btn"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
