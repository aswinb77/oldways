import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Trophy,
  Sparkles,
  Check,
  UserCheck,
  Shield,
  AlertCircle,
  LogOut,
  UserPlus,
  LogIn,
  Lock,
  Loader2,
} from 'lucide-react'
import { DEFAULT_AVATARS, saveUser, syncUserToCloud } from '../utils/userStore'
import {
  registerAccount,
  loginAccount,
  logoutAccount,
  checkUsernameAvailable,
} from '../utils/authStore'

export default function AuthModal({ isOpen, onClose, user, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState(user.isGuest ? 'login' : 'profile')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar || DEFAULT_AVATARS[0].src)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const checkTimerRef = useRef(null)

  // Reset form when modal opens or user changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(user.isGuest ? 'login' : 'profile')
      setUsername(user.isGuest ? '' : user.username)
      setPassword('')
      setConfirmPassword('')
      setSelectedAvatar(user.avatar || DEFAULT_AVATARS[0].src)
      setErrorMsg('')
      setSuccessMsg('')
      setUsernameStatus(null)
    }
  }, [isOpen, user])

  // Real-time username availability check on register tab
  useEffect(() => {
    if (activeTab !== 'register') {
      setUsernameStatus(null)
      return
    }

    const trimmed = username.trim()
    if (trimmed.length < 3) {
      setUsernameStatus(null)
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameStatus('invalid')
      return
    }

    setUsernameStatus('checking')
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current)

    checkTimerRef.current = setTimeout(async () => {
      const isFree = await checkUsernameAvailable(trimmed)
      setUsernameStatus(isFree ? 'available' : 'taken')
    }, 400)

    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
    }
  }, [username, activeTab])

  if (!isOpen) return null

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    try {
      const loggedIn = await loginAccount({ username, password })
      onUserUpdated(loggedIn)
      setSuccessMsg(`Welcome back, ${loggedIn.username}!`)
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Registration
  const handleRegister = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify and re-enter.')
      return
    }

    if (usernameStatus === 'taken') {
      setErrorMsg('This username is already taken. Please choose another one.')
      return
    }

    setLoading(true)

    try {
      const newAcc = await registerAccount({
        username,
        password,
        avatar: selectedAvatar,
      })
      onUserUpdated(newAcc)
      setSuccessMsg(`Account created! Welcome to the Arena, ${newAcc.username}!`)
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Log Out
  const handleLogoutClick = () => {
    const guest = logoutAccount()
    onUserUpdated(guest)
    setSuccessMsg('Logged out. Switched to Guest Mode.')
    setTimeout(() => {
      onClose()
    }, 800)
  }


  // Handle Avatar Update for Logged-In User
  const handleSaveAvatar = () => {
    if (user.isGuest) return
    const updated = { ...user, avatar: selectedAvatar }
    saveUser(updated)
    syncUserToCloud(updated)
    onUserUpdated(updated)
    setSuccessMsg('Avatar updated!')
    setTimeout(() => setSuccessMsg(''), 1500)
  }

  return (
    <div className="creamy-modal-overlay" onClick={onClose}>
      <div className="creamy-modal-content auth-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="auth-header">
          <div className="auth-icon-badge">
            <Trophy size={28} color="#D97706" />
          </div>
          <h2 className="auth-title">
            {user.isGuest ? 'Arena Account' : `${user.username}'s Profile`}
          </h2>
          <p className="auth-subtitle">
            {user.isGuest
              ? 'Log in or Register a unique username to compete on the Weekly Leaderboard!'
              : 'Logged in and tracking official 1v1 online duel wins.'}
          </p>
        </div>

        {/* Guest Mode Tabs */}
        {user.isGuest && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'login' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('login')
                setErrorMsg('')
              }}
            >
              <LogIn size={15} />
              <span>Log In</span>
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'register' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('register')
                setErrorMsg('')
              }}
            >
              <UserPlus size={15} />
              <span>Register</span>
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="auth-alert-error">
            <AlertCircle size={17} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="auth-alert-success">
            <Check size={17} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ─── TAB 1: LOG IN ─── */}
        {user.isGuest && activeTab === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label className="auth-label">Username</label>
              <input
                type="text"
                className="creamy-input"
                placeholder="Enter your registered username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
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
                required
              />
            </div>

            <button
              type="submit"
              className="creamy-btn btn-primary auth-submit-btn"
              disabled={loading}
            >
              {loading ? <Loader2 size={18} className="spin-anim" /> : <LogIn size={18} />}
              <span>{loading ? 'Verifying Account...' : 'Log In & Play'}</span>
            </button>

            <div className="auth-switch-strip">
              <span>Don't have an account yet?</span>
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => {
                  setActiveTab('register')
                  setErrorMsg('')
                }}
              >
                Create Account (Register)
              </button>
            </div>
          </form>
        )}

        {/* ─── TAB 2: REGISTER (SIGN UP) ─── */}
        {user.isGuest && activeTab === 'register' && (
          <form onSubmit={handleRegister} className="auth-form">
            {/* Avatar Picker */}
            <div className="avatar-selector-section">
              <label className="auth-label">Select Your Shield Avatar</label>
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

            <div className="form-group">
              <div className="label-with-status">
                <label className="auth-label">Choose Unique Username</label>
                {usernameStatus === 'checking' && (
                  <span className="user-status-text status-checking">
                    <Loader2 size={12} className="spin-anim" /> Checking...
                  </span>
                )}
                {usernameStatus === 'available' && (
                  <span className="user-status-text status-available">
                    <Check size={12} /> Available
                  </span>
                )}
                {usernameStatus === 'taken' && (
                  <span className="user-status-text status-taken">
                    <X size={12} /> Taken
                  </span>
                )}
                {usernameStatus === 'invalid' && (
                  <span className="user-status-text status-taken">
                    Letters & numbers only
                  </span>
                )}
              </div>
              <input
                type="text"
                className={`creamy-input ${usernameStatus === 'taken' ? 'input-error' : usernameStatus === 'available' ? 'input-success' : ''}`}
                placeholder="e.g. Aswin_Pro or Rahul_99"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={16}
                required
              />
              <span className="auth-helper-text">3–16 characters (letters, numbers, underscores)</span>
            </div>

            <div className="form-group">
              <label className="auth-label">Password (Min 6 Characters)</label>
              <input
                type="password"
                className="creamy-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <div className="form-group">
              <label className="auth-label">Confirm Password</label>
              <input
                type="password"
                className="creamy-input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              className="creamy-btn btn-primary auth-submit-btn"
              disabled={loading || usernameStatus === 'taken'}
            >
              {loading ? <Loader2 size={18} className="spin-anim" /> : <UserPlus size={18} />}
              <span>{loading ? 'Registering Account...' : 'Register & Join Arena'}</span>
            </button>

            <div className="auth-switch-strip">
              <span>Already have an account?</span>
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => {
                  setActiveTab('login')
                  setErrorMsg('')
                }}
              >
                Log In Here
              </button>
            </div>
          </form>
        )}


        {/* ─── LOGGED IN PROFILE VIEW ─── */}
        {!user.isGuest && (
          <div className="logged-in-profile-view">
            {/* Avatar Selector for Logged in */}
            <div className="avatar-selector-section">
              <label className="auth-label">Change Shield Avatar</label>
              <div className="avatar-grid">
                {DEFAULT_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    className={`avatar-option-btn ${selectedAvatar === av.src ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedAvatar(av.src)
                    }}
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
              {selectedAvatar !== user.avatar && (
                <button
                  type="button"
                  className="creamy-btn btn-sm save-avatar-btn"
                  onClick={handleSaveAvatar}
                >
                  Save New Avatar
                </button>
              )}
            </div>

            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-num">{user.points || 0}</span>
                <span className="stat-label">Weekly Points</span>
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
              <span>
                Tier: <strong>{user.badge || 'Bronze'}</strong> (Earn +25 pts per online 1v1 win)
              </span>
            </div>

            <button
              type="button"
              className="creamy-btn auth-logout-btn"
              onClick={handleLogoutClick}
            >
              <LogOut size={16} />
              <span>Log Out (Switch to Guest)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
