import React, { useState } from 'react'
import {
  Users,
  Zap,
  Share2,
  ArrowRight,
  Play,
  Sparkles,
  Bot,
  Swords,
  Shield,
  Flame,
  Gamepad2,
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
    <div className="lobby-container">
      {/* ── 1. Tactical Game Arena Switcher ── */}
      <div className="game-select-strip">
        <button
          type="button"
          className={`game-pill-btn ${selectedGame === 'poojyam' ? 'is-active' : ''}`}
          onClick={() => setSelectedGame('poojyam')}
        >
          <div className="game-pill-header">
            <span className="game-pill-badge">FLAGSHIP CLASSIC</span>
            <span className="game-pill-dot" />
          </div>
          <span className="game-pill-title">Poojyam Vettu (പൂജ്യം വെട്ട്)</span>
          <span className="game-pill-sub">55 Strategic Dots · 27 Cut Lines</span>
        </button>

        <button
          type="button"
          className={`game-pill-btn ${selectedGame === 'quick' ? 'is-active' : ''}`}
          onClick={() => setSelectedGame('quick')}
        >
          <div className="game-pill-header">
            <span className="game-pill-badge fast-badge">BLITZ SHOWDOWN</span>
            <span className="game-pill-dot" />
          </div>
          <span className="game-pill-title">Quick Vettu (3x3 Fast)</span>
          <span className="game-pill-sub">3 In-a-Row · 60s Rapid Blitz</span>
        </button>
      </div>

      {/* ── 2. Hero 1v1 Online Battle Centerpiece (Game Launcher) ── */}
      <div className="arcade-battle-hero">
        <div className="hero-top-strip">
          <div className="hero-live-tag">
            <span className="live-dot" />
            <span>LIVE 1v1 ARENA</span>
          </div>
          <div className="hero-stakes-badge">
            <Sparkles size={14} color="#D97706" />
            <span>
              {user.isGuest ? 'Casual 1v1 Duel' : 'Ranked Duel · +25 Weekly Pts on Win'}
            </span>
          </div>
        </div>

        {/* Dynamic 1v1 Versus Showcase */}
        <div className="hero-versus-stage">
          {/* Player Fighter Card */}
          <div className="fighter-pod player-pod">
            <div className="fighter-avatar-frame">
              <img
                src={user.avatar || '/assets/avatar-red.png'}
                alt={user.username}
                className="fighter-avatar"
              />
              <span className="fighter-badge-icon">
                <Shield size={14} color="#FFF" />
              </span>
            </div>
            <div className="fighter-details">
              <span className="fighter-name">{user.username}</span>
              <span className="fighter-tier">
                {user.isGuest ? 'Guest Fighter' : `${user.badge || 'Bronze'} · ${user.points || 0} pts`}
              </span>
            </div>
          </div>

          {/* Epic VS Clash Emblem */}
          <div className="versus-clash-emblem">
            <div className="clash-ring">
              <Swords size={26} className="clash-swords-icon" />
            </div>
            <span className="clash-vs-text">VS</span>
          </div>

          {/* Opponent Mystery Fighter Card */}
          <div className="fighter-pod opponent-pod">
            <div className="fighter-avatar-frame mystery-frame">
              <img
                src="/assets/avatar-orange.png"
                alt="Opponent"
                className="fighter-avatar mystery-avatar"
              />
              <span className="fighter-badge-icon mystery-badge">?</span>
            </div>
            <div className="fighter-details">
              <span className="fighter-name">Challenger</span>
              <span className="fighter-tier">Online Matchmaking</span>
            </div>
          </div>
        </div>

        {/* Big 3D Tactile Battle Action Button */}
        <button
          type="button"
          className="arcade-launch-btn"
          onClick={onStartMatchmaking}
        >
          <div className="launch-btn-inner">
            <div className="launch-icon-box">
              <Zap size={22} fill="#FFF" color="#FFF" />
            </div>
            <div className="launch-text-box">
              <span className="launch-title">FIND 1v1 OPPONENT</span>
              <span className="launch-sub">Instant matchmaking across the network</span>
            </div>
          </div>
        </button>

        <div className="hero-bottom-ticker">
          <span>⚡ Real-time Peer Connection</span>
          <span className="ticker-dot">•</span>
          <span>Average Search: ~3s</span>
          <span className="ticker-dot">•</span>
          <span>Fair Elo Pairing</span>
        </div>
      </div>

      {/* ── 3. Dual Arcade Consoles: Friend Duel & Bot Dojo ── */}
      <div className="arcade-consoles-grid">
        {/* Console 1: Private Friend Room */}
        <div className="arcade-console-card friend-console">
          <div className="console-header">
            <div className="console-icon blue-console-icon">
              <Users size={22} color="#FFF" />
            </div>
            <div className="console-title-wrap">
              <span className="console-badge-tag blue-tag">PRIVATE DUEL</span>
              <h3 className="console-title">Play with a Friend</h3>
            </div>
          </div>

          <p className="console-desc">
            Host a private room to send an invite link or room code directly to your friend.
          </p>

          {!showJoinInput ? (
            <div className="console-actions">
              <button
                type="button"
                className="creamy-btn btn-blue console-btn-primary"
                onClick={onCreateFriendRoom}
              >
                <Share2 size={17} />
                <span>Create Battle Room</span>
              </button>

              <button
                type="button"
                className="creamy-btn console-btn-secondary"
                onClick={() => setShowJoinInput(true)}
              >
                <span>Have a Code? Join Room</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleJoinSubmit} className="console-join-form">
              <div className="console-input-row">
                <input
                  type="text"
                  className="creamy-input arcade-code-input"
                  placeholder="CODE: PV-8492"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="creamy-btn btn-blue join-go-btn">
                  <ArrowRight size={18} />
                </button>
              </div>
              <button
                type="button"
                className="cancel-join-link"
                onClick={() => setShowJoinInput(false)}
              >
                ← Back to create room
              </button>
            </form>
          )}
        </div>

        {/* Console 2: AI Sparring Dojo */}
        <div className="arcade-console-card bot-console">
          <div className="console-header">
            <div className="console-icon gold-console-icon">
              <Bot size={22} color="#FFF" />
            </div>
            <div className="console-title-wrap">
              <span className="console-badge-tag gold-tag">OFFLINE TRAINING</span>
              <h3 className="console-title">Bot Sparring Dojo</h3>
            </div>
          </div>

          <p className="console-desc">
            Sharpen your line-cutting and tactical blocking skills against our heuristic AI.
          </p>

          {/* Difficulty Chips */}
          <div className="bot-diff-strip">
            {[
              { id: 'casual', label: 'Casual' },
              { id: 'tactical', label: 'Tactical' },
              { id: 'insane', label: 'Insane IQ 🔥' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                className={`diff-chip-btn ${selectedBotDiff === d.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedBotDiff(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="creamy-btn btn-gold console-btn-primary"
            onClick={() => onStartBotGame(selectedBotDiff)}
          >
            <Play size={17} fill="#FFF" />
            <span>Fight {selectedBotDiff.toUpperCase()} Bot</span>
          </button>
        </div>
      </div>

      {/* ── 4. Gamer HUD / Season Pass Banner ── */}
      {user.isGuest ? (
        <div className="arcade-guest-banner">
          <div className="guest-banner-left">
            <img src="/assets/aswin-duo.png" alt="Mascot" className="guest-mascot" />
            <div className="guest-banner-text">
              <h4 className="guest-banner-title">Compete on the Weekly Leaderboard!</h4>
              <p className="guest-banner-sub">
                You're in Guest Mode. Register a unique handle to save your stats and climb the ranks.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="creamy-btn btn-primary guest-cta-btn"
            onClick={onOpenAuth}
          >
            <Sparkles size={16} />
            <span>Create Arena ID</span>
          </button>
        </div>
      ) : (
        <div className="arcade-gamer-hud">
          <div className="hud-left">
            <img src={user.avatar} alt={user.username} className="hud-avatar" />
            <div className="hud-info">
              <span className="hud-greeting">Player Logged In: <strong>{user.username}</strong></span>
              <span className="hud-sub">Badge: {user.badge || 'Bronze'} · All 1v1 wins recorded</span>
            </div>
          </div>
          <div className="hud-stats-pills">
            <div className="hud-stat-chip">
              <Trophy size={14} color="#D97706" />
              <span>{user.points || 0} pts</span>
            </div>
            <div className="hud-stat-chip">
              <Flame size={14} color="#DC2626" />
              <span>{user.streak || 0} streak</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
