import React, { useState } from 'react'
import {
  Bot,
  Users,
  Zap,
  Play,
  Sparkles,
  Swords,
  Share2,
  ArrowRight,
  Shield,
  KeyRound,
  Flame,
  Trophy,
} from 'lucide-react'

export default function Lobby({
  selectedGame,
  setSelectedGame,
  onStartBotGame,
  onCreateFriendRoom,
  onJoinFriendRoom,
  onStartMatchmaking,
  user,
  onOpenAuth,
}) {
  const [selectedBotDiff, setSelectedBotDiff] = useState('insane')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [showJoinInput, setShowJoinInput] = useState(false)

  const handleJoinSubmit = (e) => {
    e.preventDefault()
    if (!joinCodeInput.trim()) return
    onJoinFriendRoom(joinCodeInput.trim().toUpperCase())
  }

  return (
    <div className="lobby-arcade-wrap">
      {/* ── 1. Arcade Game Board Selector ── */}
      <div className="arcade-game-switch">
        <button
          type="button"
          className={`arcade-switch-tab ${selectedGame === 'poojyam' ? 'is-active' : ''}`}
          onClick={() => setSelectedGame('poojyam')}
        >
          <div className="tab-flagship-pill">FLAGSHIP</div>
          <span className="tab-title">Poojyam Vettu</span>
          <span className="tab-malayalam">പൂജ്യം വെട്ട് · 55 Dots</span>
        </button>

        <button
          type="button"
          className={`arcade-switch-tab ${selectedGame === 'quick' ? 'is-active' : ''}`}
          onClick={() => setSelectedGame('quick')}
        >
          <div className="tab-fast-pill">⚡ FAST 60S</div>
          <span className="tab-title">Quick Vettu</span>
          <span className="tab-malayalam">3x3 Grid · Blitz Duel</span>
        </button>
      </div>

      {/* ── 2. Hero Battle Station: 1v1 Online Matchmaking ── */}
      <div className="arcade-hero-stage">
        <div className="stage-glow-accent" />
        <div className="stage-header-row">
          <div className="stage-live-badge">
            <span className="stage-live-dot" />
            <span>LIVE ONLINE 1v1</span>
          </div>
          <div className="stage-rank-pill">
            <Flame size={14} color="#EA580C" />
            <span>{user.isGuest ? 'CASUAL DUEL' : 'RANKED ARENA (+25 PTS)'}</span>
          </div>
        </div>

        <div className="stage-body">
          <div className="stage-info">
            <h2 className="stage-title">Online 1v1 Duel</h2>
            <p className="stage-subtitle">
              {user.isGuest
                ? 'Play against real players online. Log in to save win streaks and enter the Weekly Leaderboard!'
                : 'Instant matchmaking against live online players. Win to earn +25 points and climb the ranks!'}
            </p>

            <div className="stage-tags-row">
              <span className="stage-tag">
                <Zap size={13} color="#2563EB" />
                <span>Instant Match</span>
              </span>
              <span className="stage-tag">
                <Trophy size={13} color="#D97706" />
                <span>{user.isGuest ? 'Guest Match' : '+25 Pts on Win'}</span>
              </span>
              <span className="stage-tag">
                <Shield size={13} color="#16A34A" />
                <span>{selectedGame === 'quick' ? '3x3 Quick' : '55-Dots Board'}</span>
              </span>
            </div>
          </div>

          <div className="stage-action-wrap">
            <button
              type="button"
              className="arcade-hero-play-btn"
              onClick={onStartMatchmaking}
            >
              <div className="btn-icon-circle">
                <Swords size={26} color="#FFF" />
              </div>
              <div className="btn-text-block">
                <span className="btn-main-text">FIND ONLINE MATCH</span>
                <span className="btn-sub-text">1v1 Duel · Search Challenger</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Secondary Battle Pods: Friend Duel & AI Practice ── */}
      <div className="arcade-pods-grid">
        {/* POD A: Play with Friend (Room Code) */}
        <div className="arcade-pod pod-friend">
          <div className="pod-header">
            <div className="pod-icon-box box-blue">
              <Users size={22} color="#FFF" />
            </div>
            <div className="pod-title-wrap">
              <h3 className="pod-title">Friend Battle</h3>
              <span className="pod-subtitle">Private room duel via code or link</span>
            </div>
          </div>

          {!showJoinInput ? (
            <div className="pod-actions-stack">
              <button
                type="button"
                className="arcade-btn btn-blue-tactile"
                onClick={onCreateFriendRoom}
              >
                <Share2 size={16} />
                <span>Create Private Room</span>
              </button>

              <button
                type="button"
                className="arcade-btn btn-outline-tactile"
                onClick={() => setShowJoinInput(true)}
              >
                <KeyRound size={16} />
                <span>Have a Code? Join Room</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleJoinSubmit} className="pod-code-form">
              <div className="code-input-row">
                <input
                  type="text"
                  className="creamy-input pod-code-field"
                  placeholder="e.g. PV-8492"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="arcade-btn btn-blue-tactile pod-code-submit">
                  <ArrowRight size={18} />
                </button>
              </div>
              <button
                type="button"
                className="pod-cancel-link"
                onClick={() => setShowJoinInput(false)}
              >
                ← Back to Create Room
              </button>
            </form>
          )}
        </div>

        {/* POD B: VS AI Practice */}
        <div className="arcade-pod pod-bot">
          <div className="pod-header">
            <div className="pod-icon-box box-amber">
              <Bot size={22} color="#FFF" />
            </div>
            <div className="pod-title-wrap">
              <h3 className="pod-title">VS Bot Practice</h3>
              <span className="pod-subtitle">Offline AI battle simulation</span>
            </div>
          </div>

          {/* Difficulty Chips */}
          <div className="bot-diff-strip">
            {[
              { id: 'casual', label: 'Casual', icon: '🟢' },
              { id: 'tactical', label: 'Tactical', icon: '🟡' },
              { id: 'insane', label: 'Insane IQ', icon: '🔥' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                className={`diff-chip-btn ${selectedBotDiff === d.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedBotDiff(d.id)}
              >
                <span>{d.icon}</span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="arcade-btn btn-gold-tactile"
            onClick={() => onStartBotGame(selectedBotDiff)}
          >
            <Play size={16} fill="#FFF" />
            <span>Start VS {selectedBotDiff.toUpperCase()} Bot</span>
          </button>
        </div>
      </div>

      {/* ── 4. Guest Leaderboard Rank-Up Strip ── */}
      {user.isGuest && (
        <div className="arcade-guest-banner">
          <div className="guest-banner-info">
            <div className="banner-icon-badge">
              <Trophy size={20} color="#D97706" />
            </div>
            <div className="banner-text">
              <span className="banner-title">Compete on the Weekly Leaderboard!</span>
              <span className="banner-sub">
                Register a unique handle to track official 1v1 wins and earn Weekly Rank points.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="arcade-btn btn-login-banner"
            onClick={onOpenAuth}
          >
            <Sparkles size={15} />
            <span>Log In / Register</span>
          </button>
        </div>
      )}
    </div>
  )
}

