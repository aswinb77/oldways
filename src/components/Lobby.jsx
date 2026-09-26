import React, { useState } from 'react'
import {
  Users,
  Bot,
  Zap,
  Plus,
  Link2,
  Play,
  ArrowRight,
  Lock,
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
    <div className="mobile-dash-container">
      {/* ─── CARD 1: FLAGSHIP GAME (POOJYAM VETTU) ─── */}
      <section
        className={`creamy-card dash-game-banner ${selectedGame === 'poojyam' ? 'is-active-banner' : ''}`}
        onClick={() => setSelectedGame('poojyam')}
        role="button"
        tabIndex={0}
      >
        <div className="banner-left">
          <span className="game-pill-badge">★ FLAGSHIP</span>
          <h2 className="banner-title">
            Poojyam Vettu
            <span className="banner-malayalam"> (പൂജ്യം വെട്ട്)</span>
          </h2>
          <div className="banner-meta">
            <span>● 55 Dots</span>
            <span className="meta-sep">•</span>
            <span>✂ 27 Cut Lines</span>
          </div>
        </div>

        <div className="banner-right">
          <button
            type="button"
            className="creamy-btn btn-primary banner-action-btn"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedGame('poojyam')
            }}
          >
            <span>Play Now</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ─── CARD 2: FAST MATCH (QUICK VETTU 3x3) ─── */}
      <section
        className={`creamy-card dash-game-banner ${selectedGame === 'quick' ? 'is-active-banner' : ''}`}
        onClick={() => setSelectedGame('quick')}
        role="button"
        tabIndex={0}
      >
        <div className="banner-left">
          <span className="game-pill-badge fast-badge">⚡ FAST MATCH</span>
          <h2 className="banner-title">Quick Vettu (3x3 Fast)</h2>
          <div className="banner-meta">
            <span>3 In-a-Row</span>
            <span className="meta-sep">•</span>
            <span>60s Blitz</span>
          </div>
        </div>

        <div className="banner-right">
          <button
            type="button"
            className={`creamy-btn banner-arrow-pill ${selectedGame === 'quick' ? 'btn-blue' : 'btn-outline-creamy'}`}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedGame('quick')
            }}
            aria-label="Select Quick Vettu"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ─── CARD 3: PLAY WITH A FRIEND ─── */}
      <section className="creamy-card dash-mode-card">
        <div className="mode-card-main-row">
          {/* Original Chunky 3D Blue Badge */}
          <div className="mode-badge-icon blue-badge">
            <Users size={24} color="#FFFFFF" />
          </div>

          <div className="mode-card-text">
            <h3 className="mode-card-title">Play with a Friend</h3>
            <p className="mode-card-desc">
              Create a room code or join with a friend to duel in real-time.
            </p>
          </div>

          {!showJoinInput && (
            <div className="friend-btns-stack">
              <button
                type="button"
                className="creamy-btn btn-blue friend-pill-btn"
                onClick={onCreateFriendRoom}
              >
                <Plus size={16} />
                <span>Create Room</span>
              </button>

              <button
                type="button"
                className="creamy-btn friend-pill-btn mode-secondary-btn"
                onClick={() => setShowJoinInput(true)}
              >
                <Link2 size={15} />
                <span>Join with Code</span>
              </button>
            </div>
          )}
        </div>

        {/* Expandable Join Code Form */}
        {showJoinInput && (
          <form onSubmit={handleJoinSubmit} className="inline-join-row">
            <input
              type="text"
              className="creamy-input inline-code-input"
              placeholder="e.g. PV-8291"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="creamy-btn btn-blue inline-join-submit-btn">
              <span>Join</span>
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="inline-cancel-btn"
              onClick={() => setShowJoinInput(false)}
            >
              Cancel
            </button>
          </form>
        )}
      </section>

      {/* ─── CARD 4: QUICK MATCHMAKING ─── */}
      <section className="creamy-card dash-mode-card">
        <div className="mode-card-top-bar">
          <div className="mode-card-main-row">
            {/* Original Chunky 3D Red/Amber Badge */}
            <div className="mode-badge-icon pulse-icon">
              <Zap size={24} color="#FFFFFF" />
            </div>

            <div className="mode-card-text">
              <h3 className="mode-card-title">Quick Matchmaking</h3>
              <p className="mode-card-desc">
                Find an online opponent and compete in ranked 1v1 matches.
              </p>
            </div>
          </div>

          <span className="live-status-pill">
            <span className="live-dot" />
            Live Online 1v1
          </span>
        </div>

        <div className="mode-card-bottom-row">
          {user.isGuest ? (
            <button
              type="button"
              className="creamy-btn btn-disabled-locked wide-action-btn"
              onClick={onOpenAuth}
            >
              <Lock size={16} />
              <span>Login to Find Match</span>
            </button>
          ) : (
            <button
              type="button"
              className="creamy-btn btn-primary wide-action-btn"
              onClick={onStartMatchmaking}
            >
              <Play size={16} fill="#FFF" />
              <span>Find Online Match</span>
            </button>
          )}
        </div>
      </section>

      {/* ─── CARD 5: PLAY WITH BOT ─── */}
      <section className="creamy-card dash-mode-card">
        <div className="mode-card-top-bar">
          <div className="mode-card-main-row">
            {/* Original Chunky 3D Orange Badge */}
            <div className="mode-badge-icon orange-badge">
              <Bot size={24} color="#FFFFFF" />
            </div>

            <div className="mode-card-text">
              <h3 className="mode-card-title">Play with Bot</h3>
              <p className="mode-card-desc">
                Test your skills offline against our heuristic AI.
              </p>
            </div>
          </div>

          {/* Original Creamy Difficulty Selector */}
          <div className="bot-diff-strip">
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
        </div>

        <div className="mode-card-bottom-row">
          <button
            type="button"
            className="creamy-btn btn-gold wide-action-btn"
            onClick={() => onStartBotGame(selectedBotDiff)}
          >
            <Play size={16} fill="#FFF" />
            <span>Play vs {selectedBotDiff.toUpperCase()} Bot</span>
          </button>
        </div>
      </section>
    </div>
  )
}


