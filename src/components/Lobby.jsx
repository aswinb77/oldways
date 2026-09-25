import React, { useState } from 'react'
import { Bot, Users, Zap, Share2, Copy, Check, ArrowRight, Play, Sparkles, ShieldAlert, Lock } from 'lucide-react'

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
  const [codeCopied, setCodeCopied] = useState(false)
  const [showJoinInput, setShowJoinInput] = useState(false)

  const handleJoinSubmit = (e) => {
    e.preventDefault()
    if (!joinCodeInput.trim()) return
    onJoinFriendRoom(joinCodeInput.trim().toUpperCase())
  }

  return (
    <div className="lobby-container">
      {/* Game Selector Tab */}
      <div className="game-select-strip">
        <button
          type="button"
          className={`game-pill-btn ${selectedGame === 'poojyam' ? 'is-active' : ''}`}
          onClick={() => setSelectedGame('poojyam')}
        >
          <span className="game-pill-badge">FLAGSHIP</span>
          <span className="game-pill-title">Poojyam Vettu (പൂജ്യം വെട്ട്)</span>
          <span className="game-pill-sub">55 Dots · 27 Cut Lines</span>
        </button>

        <button
          type="button"
          className={`game-pill-btn ${selectedGame === 'quick' ? 'is-active' : ''}`}
          onClick={() => setSelectedGame('quick')}
        >
          <span className="game-pill-badge fast-badge">FAST MATCH</span>
          <span className="game-pill-title">Quick Vettu (3x3 Fast)</span>
          <span className="game-pill-sub">3 In-a-Row · 60s Blitz</span>
        </button>
      </div>

      {/* Mode Cards Grid */}
      <div className="mode-cards-grid">
        {/* Mode 1: 1v1 Online Matchmaking */}
        <div className={`creamy-card mode-card match-highlight-card ${user.isGuest ? 'is-guest-locked' : ''}`}>
          <div className="mode-card-header">
            <div className={`mode-badge-icon ${user.isGuest ? 'locked-badge' : 'pulse-icon'}`}>
              {user.isGuest ? <Lock size={24} color="#786B5E" /> : <Zap size={26} color="#FFFFFF" />}
            </div>
            {user.isGuest ? (
              <span className="live-status-pill pill-locked" onClick={onOpenAuth} role="button">
                <Lock size={12} />
                Login Required
              </span>
            ) : (
              <span className="live-status-pill">
                <span className="live-dot" />
                Live Online 1v1
              </span>
            )}
          </div>

          <h3 className="mode-title">Quick Matchmaking</h3>
          <p className="mode-desc">
            {user.isGuest
              ? 'Find an online opponent in ranked 1v1. Log in to activate matchmaking and earn weekly points!'
              : 'Find an available online player instantly. Logged-in players earn +25 Weekly Points on win!'}
          </p>

          <div className="mode-perk-row">
            <Sparkles size={15} color="#D97706" />
            <span>Official Ranked 1v1 Match</span>
          </div>

          {user.isGuest ? (
            <button
              type="button"
              className="creamy-btn mode-action-btn btn-disabled-locked"
              onClick={onOpenAuth}
              title="Click to Log In and enable online matchmaking"
            >
              <Lock size={18} />
              <span>Login to Find Match</span>
            </button>
          ) : (
            <button
              type="button"
              className="creamy-btn btn-primary mode-action-btn"
              onClick={onStartMatchmaking}
            >
              <Play size={18} fill="#FFF" />
              <span>Find Online Match</span>
            </button>
          )}
        </div>

        {/* Mode 2: Play with Friend (Room Code) */}
        <div className="creamy-card mode-card friend-card">
          <div className="mode-card-header">
            <div className="mode-badge-icon blue-badge">
              <Users size={26} color="#FFFFFF" />
            </div>
            <span className="code-pill">Private 1v1 Room</span>
          </div>

          <h3 className="mode-title">Play with a Friend</h3>
          <p className="mode-desc">
            Create a unique room code or share a private link directly with friends to duel in real-time.
          </p>

          {!showJoinInput ? (
            <div className="friend-actions-group">
              <button
                type="button"
                className="creamy-btn btn-blue mode-action-btn"
                onClick={onCreateFriendRoom}
              >
                <Share2 size={17} />
                <span>Create Room Code</span>
              </button>

              <button
                type="button"
                className="creamy-btn mode-secondary-btn"
                onClick={() => setShowJoinInput(true)}
              >
                <span>Have a Code? Join Room</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleJoinSubmit} className="join-code-form">
              <div className="join-input-group">
                <input
                  type="text"
                  className="creamy-input code-input"
                  placeholder="e.g. PV-8492"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="creamy-btn btn-blue">
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

        {/* Mode 3: Play with Bot */}
        <div className="creamy-card mode-card bot-card">
          <div className="mode-card-header">
            <div className="mode-badge-icon orange-badge">
              <Bot size={26} color="#FFFFFF" />
            </div>
            <span className="practice-pill">Solo Practice</span>
          </div>

          <h3 className="mode-title">Play with Bot</h3>
          <p className="mode-desc">
            Test your skills offline against our heuristic AI. Choose difficulty level below:
          </p>

          <div className="bot-diff-selector">
            {[
              { id: 'casual', label: 'Casual' },
              { id: 'tactical', label: 'Tactical' },
              { id: 'insane', label: 'Insane IQ 🔥' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                className={`diff-btn ${selectedBotDiff === d.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedBotDiff(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="creamy-btn btn-gold mode-action-btn"
            onClick={() => onStartBotGame(selectedBotDiff)}
          >
            <Play size={18} fill="#FFF" />
            <span>Play vs {selectedBotDiff.toUpperCase()} Bot</span>
          </button>
        </div>
      </div>

      {/* Guest Leaderboard Banner if guest */}
      {user.isGuest && (
        <div className="creamy-card guest-tip-card">
          <div className="guest-tip-left">
            <img src="/assets/aswin-duo.png" alt="Companion" className="tip-avatar" />
            <div>
              <h4 className="tip-title">Want to see your name on the Leaderboard?</h4>
              <p className="tip-desc">
                Currently playing in Guest Mode. Log in to track your win streaks and earn weekly rating points!
              </p>
            </div>
          </div>
          <button
            type="button"
            className="creamy-btn btn-primary"
            onClick={onOpenAuth}
          >
            Log In Now
          </button>
        </div>
      )}
    </div>
  )
}
