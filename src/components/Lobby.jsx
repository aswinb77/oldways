import React, { useState } from 'react'
import {
  Users,
  Share2,
  ArrowRight,
  Play,
  Bot,
  Swords,
  Shield,
  Info,
  X,
  LogIn,
  RotateCcw,
} from 'lucide-react'

export default function Lobby({
  selectedGame,
  setSelectedGame,
  onStartBotGame,
  onCreateFriendRoom,
  onJoinFriendRoom,
  onStartMatchmaking,
  active1v1Match,
  onRejoin1v1Match,
  onAbandon1v1Match,
  user,
  onOpenAuth,
}) {
  const [selectedBotDiff, setSelectedBotDiff] = useState('insane')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [showStakesInfo, setShowStakesInfo] = useState(false)

  const handleJoinSubmit = (e) => {
    e.preventDefault()
    if (!joinCodeInput.trim()) return
    onJoinFriendRoom(joinCodeInput.trim().toUpperCase())
  }

  return (
    <div className="lobby-container">
      {/* ── 1. Horizontal Square Game Tiles with SVG Backgrounds ── */}
      <div className="game-squares-strip">
        {/* Square 1: Poojyam Vettu (55 Dots) */}
        <button
          type="button"
          className={`game-square-card ${selectedGame === 'poojyam' ? 'is-active' : ''}`}
          onClick={() => setSelectedGame('poojyam')}
        >
          {/* Stylized 55-Dots Triangle SVG Background */}
          <svg className="square-bg-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="44" cy="20" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="68" cy="20" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="92" cy="20" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="116" cy="20" r="4.5" fill="#E25B45" fillOpacity="0.22" />

            <circle cx="20" cy="44" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="44" cy="44" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="68" cy="44" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="92" cy="44" r="4.5" fill="#E25B45" fillOpacity="0.22" />

            <circle cx="20" cy="68" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="44" cy="68" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="68" cy="68" r="4.5" fill="#E25B45" fillOpacity="0.22" />

            <circle cx="20" cy="92" r="4.5" fill="#E25B45" fillOpacity="0.22" />
            <circle cx="44" cy="92" r="4.5" fill="#E25B45" fillOpacity="0.22" />

            <circle cx="20" cy="116" r="4.5" fill="#E25B45" fillOpacity="0.22" />

            {/* Cut line stroke */}
            <line x1="12" y1="124" x2="124" y2="12" stroke="#DC2626" strokeWidth="3" strokeDasharray="5 5" strokeOpacity="0.45" />
          </svg>

          <div className="square-content">
            <span className="square-badge red-badge">55 Dots</span>
            <div className="square-title-wrap">
              <span className="square-title">Poojyam Vettu</span>
              <span className="square-sub">പൂജ്യം വെട്ട് · Classic</span>
            </div>
          </div>
          <span className="square-active-indicator" />
        </button>

        {/* Square 2: Quick Vettu (3x3 Fast) */}
        <button
          type="button"
          className={`game-square-card ${selectedGame === 'quick' ? 'is-active' : ''}`}
          onClick={() => setSelectedGame('quick')}
        >
          {/* Stylized 3x3 Grid SVG Background */}
          <svg className="square-bg-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="50" y1="15" x2="50" y2="125" stroke="#2563EB" strokeWidth="3" strokeOpacity="0.2" strokeLinecap="round" />
            <line x1="90" y1="15" x2="90" y2="125" stroke="#2563EB" strokeWidth="3" strokeOpacity="0.2" strokeLinecap="round" />
            <line x1="15" y1="50" x2="125" y2="50" stroke="#2563EB" strokeWidth="3" strokeOpacity="0.2" strokeLinecap="round" />
            <line x1="15" y1="90" x2="125" y2="90" stroke="#2563EB" strokeWidth="3" strokeOpacity="0.2" strokeLinecap="round" />

            {/* X symbol */}
            <path d="M25 25L39 39M39 25L25 39" stroke="#E25B45" strokeWidth="3.5" strokeLinecap="round" strokeOpacity="0.4" />
            {/* O symbol */}
            <circle cx="70" cy="70" r="12" stroke="#2563EB" strokeWidth="3.5" strokeOpacity="0.4" />
            {/* Winning line */}
            <line x1="20" y1="20" x2="120" y2="120" stroke="#F59E0B" strokeWidth="3" strokeDasharray="4 4" strokeOpacity="0.45" />
          </svg>

          <div className="square-content">
            <span className="square-badge blue-badge">3x3 Blitz</span>
            <div className="square-title-wrap">
              <span className="square-title">Quick Vettu</span>
              <span className="square-sub">3-in-a-Row · 60s</span>
            </div>
          </div>
          <span className="square-active-indicator" />
        </button>
      </div>

      {/* ── 2. Minimal Battle Stage (1v1 Matchmaking) ── */}
      <div className="arcade-battle-hero minimal-battle-hero">
        <div className="hero-top-strip">
          <div className="hero-stakes-badge single-stakes-pill">
            <span>{user.isGuest ? 'Ranked 1v1 · Login Required' : 'Ranked 1v1'}</span>
            <button
              type="button"
              className="info-circle-btn sm-info-btn"
              onClick={() => setShowStakesInfo(true)}
              title="1v1 Match Rules"
              aria-label="Match Rules"
            >
              <Info size={13} />
            </button>
          </div>
        </div>

        {/* 1v1 Versus Showcase */}
        <div className="hero-versus-stage minimal-versus-stage">
          {/* Player Pod */}
          <div className="fighter-pod">
            <div className="fighter-avatar-frame">
              <img
                src={user.avatar || '/assets/avatar-red.png'}
                alt={user.username}
                className="fighter-avatar"
              />
              <span className="fighter-badge-icon">
                <Shield size={13} color="#FFF" />
              </span>
            </div>
            <span className="fighter-name">{user.username}</span>
          </div>

          {/* VS Emblem */}
          <div className="versus-clash-emblem">
            <div className="clash-ring">
              <Swords size={22} />
            </div>
            <span className="clash-vs-text">VS</span>
            {active1v1Match && (
              <span className="match-in-progress-pill">Duel Active</span>
            )}
          </div>

          {/* Opponent Pod */}
          <div className="fighter-pod">
            <div className={`fighter-avatar-frame ${active1v1Match ? '' : 'mystery-frame'}`}>
              <img
                src={active1v1Match?.opponentProfile?.avatar || '/assets/avatar-orange.png'}
                alt="Opponent"
                className={`fighter-avatar ${active1v1Match ? '' : 'mystery-avatar'}`}
              />
              <span className={`fighter-badge-icon ${active1v1Match ? '' : 'mystery-badge'}`}>
                {active1v1Match ? '⚔️' : '?'}
              </span>
            </div>
            <span className="fighter-name">
              {active1v1Match?.opponentProfile?.username || 'Challenger'}
            </span>
          </div>
        </div>

        {/* Big Action Button - Minimal & Punchy */}
        {user.isGuest ? (
          <button
            type="button"
            className="arcade-launch-btn minimal-launch-btn guest-locked-btn"
            onClick={onOpenAuth}
            title="Login required to play online 1v1 matchmaking"
          >
            <LogIn size={20} />
            <span>Login to Play 1v1</span>
          </button>
        ) : active1v1Match ? (
          <div className="active-match-actions-box">
            <button
              type="button"
              className="arcade-launch-btn minimal-launch-btn rejoin-pulse-btn"
              onClick={() => onRejoin1v1Match(active1v1Match)}
            >
              <RotateCcw size={20} />
              <span>Rejoin Active 1v1 Match</span>
            </button>
            <button
              type="button"
              className="abandon-match-btn"
              onClick={onAbandon1v1Match}
              title="Leave this match and search again"
            >
              Leave / Abandon Match
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="arcade-launch-btn minimal-launch-btn"
            onClick={onStartMatchmaking}
          >
            <Play size={20} fill="#FFF" color="#FFF" />
            <span>Start 1v1 Match</span>
          </button>
        )}

        {/* Stakes Info Modal (opened via (i)) */}
        {showStakesInfo && (
          <div className="creamy-modal-overlay" onClick={() => setShowStakesInfo(false)}>
            <div className="creamy-modal-content rules-info-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rules-modal-header">
                <h3>1v1 Online Matchmaking</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowStakesInfo(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <ul className="rules-bullets">
                <li>Instant 1v1 matchmaking with live online players.</li>
                <li>{user.isGuest ? '1v1 Online Matchmaking requires a registered account so leaderboard points and rank are tracked.' : 'Winners earn +25 points towards the weekly leaderboard.'}</li>
                <li>Average matchmaking queue time is ~3 seconds.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Dual Arcade Consoles: Friend & Bot (Clean & Minimal) ── */}
      <div className="arcade-consoles-grid">
        {/* Console 1: Play with Friend */}
        <div className="arcade-console-card minimal-console-card">
          <div className="console-header">
            <div className="console-icon blue-console-icon">
              <Users size={20} color="#FFF" />
            </div>
            <h3 className="console-title">Play with Friend</h3>
          </div>

          {!showJoinInput ? (
            <div className="console-actions">
              <button
                type="button"
                className="creamy-btn btn-blue console-btn-primary"
                onClick={onCreateFriendRoom}
              >
                <Share2 size={16} />
                <span>Create Room</span>
              </button>

              <button
                type="button"
                className="creamy-btn console-btn-secondary"
                onClick={() => setShowJoinInput(true)}
              >
                <span>Join with Code</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleJoinSubmit} className="console-join-form">
              <div className="console-input-row">
                <input
                  type="text"
                  className="creamy-input arcade-code-input"
                  placeholder="PV-XXXX"
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
                ← Back
              </button>
            </form>
          )}
        </div>

        {/* Console 2: Play with Bot */}
        <div className="arcade-console-card minimal-console-card">
          <div className="console-header">
            <div className="console-icon gold-console-icon">
              <Bot size={20} color="#FFF" />
            </div>
            <h3 className="console-title">Play with Bot</h3>
          </div>

          <div className="bot-diff-strip">
            {[
              { id: 'casual', label: 'Casual' },
              { id: 'tactical', label: 'Tactical' },
              { id: 'insane', label: 'Insane 🔥' },
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
            <Play size={16} fill="#FFF" />
            <span>Play vs Bot</span>
          </button>
        </div>
      </div>

    </div>
  )
}
