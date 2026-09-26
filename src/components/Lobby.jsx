import React, { useState } from 'react'
import {
  Users,
  Bot,
  Globe,
  Lock,
  Plus,
  Link2,
  Play,
  ArrowRight,
  ChevronRight,
  Flame,
  Crown,
  Check,
  Zap,
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

  const handleFlagshipClick = () => {
    setSelectedGame('poojyam')
  }

  const handleQuickClick = () => {
    setSelectedGame('quick')
  }

  return (
    <div className="mobile-dash-container">
      {/* ─── CARD 1: FLAGSHIP GAME (POOJYAM VETTU) ─── */}
      <section
        className={`dash-game-banner flagship-banner ${selectedGame === 'poojyam' ? 'is-selected' : ''}`}
        onClick={handleFlagshipClick}
        role="button"
        tabIndex={0}
      >
        <div className="banner-left">
          <div className="banner-badge badge-red">
            <span>★ FLAGSHIP</span>
          </div>

          <h2 className="banner-title">
            Poojyam Vettu
            <span className="banner-malayalam"> (പൂജ്യം വെട്ട്)</span>
          </h2>

          <div className="banner-meta">
            <span className="meta-dot">● 55 Dots</span>
            <span className="meta-sep">•</span>
            <span className="meta-cut">✂ 27 Cut Lines</span>
          </div>
        </div>

        <div className="banner-right">
          {/* 3D Tilted 55-Dots Card Graphic */}
          <div className="tilted-board-preview board-55-tilted">
            <svg viewBox="0 0 100 60" className="preview-dots-svg">
              <rect width="100" height="60" rx="8" fill="#FFFFFF" stroke="#FEE2E2" strokeWidth="1" />
              {[0, 1, 2, 3, 4].map((r) =>
                [0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                  <circle
                    key={`${r}-${c}`}
                    cx={10 + c * 10}
                    cy={10 + r * 10}
                    r="2.4"
                    fill="#3B82F6"
                  />
                ))
              )}
              {/* Cut Lines */}
              <line x1="8" y1="20" x2="88" y2="40" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
              <line x1="20" y1="10" x2="75" y2="50" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
              <line x1="45" y1="8" x2="90" y2="38" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <button
            type="button"
            className="banner-cta-btn btn-red-pill"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedGame('poojyam')
            }}
          >
            <span>Play Now</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ─── CARD 2: FAST MATCH (QUICK VETTU 3x3) ─── */}
      <section
        className={`dash-game-banner quick-banner ${selectedGame === 'quick' ? 'is-selected' : ''}`}
        onClick={handleQuickClick}
        role="button"
        tabIndex={0}
      >
        <div className="banner-left">
          <div className="banner-badge badge-blue">
            <span>⚡ FAST MATCH</span>
          </div>

          <h2 className="banner-title">Quick Vettu (3x3 Fast)</h2>

          <div className="banner-meta">
            <span>3 In-a-Row</span>
            <span className="meta-sep">•</span>
            <span>60s Blitz</span>
          </div>
        </div>

        <div className="banner-right">
          {/* 3D Tilted 3x3 Dots Card Graphic */}
          <div className="tilted-board-preview board-3x3-tilted">
            <svg viewBox="0 0 60 60" className="preview-dots-svg">
              <rect width="60" height="60" rx="10" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth="1" />
              {[0, 1, 2].map((r) =>
                [0, 1, 2].map((c) => (
                  <circle
                    key={`${r}-${c}`}
                    cx={15 + c * 15}
                    cy={15 + r * 15}
                    r="3.5"
                    fill="#3B82F6"
                  />
                ))
              )}
            </svg>
          </div>

          <button
            type="button"
            className={`banner-arrow-btn ${selectedGame === 'quick' ? 'is-active-btn' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedGame('quick')
            }}
            aria-label="Select Quick Vettu"
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* ─── CARD 3: PLAY WITH A FRIEND ─── */}
      <section className="dash-mode-card friend-mode-card">
        <div className="mode-card-main-row">
          {/* App Icon Square with Sparkles */}
          <div className="app-icon-wrap">
            <span className="spark spark-tl" />
            <span className="spark spark-tr" />
            <div className="app-icon-box blue-icon-box">
              <Users size={26} color="#FFFFFF" />
            </div>
          </div>

          {/* Text Content */}
          <div className="mode-card-text">
            <h3 className="mode-card-title">Play with a Friend</h3>
            <p className="mode-card-desc">
              Create a room code or join with a friend to duel in real-time.
            </p>
          </div>

          {/* Right Action Buttons */}
          {!showJoinInput && (
            <div className="friend-btns-stack">
              <button
                type="button"
                className="friend-pill-btn btn-solid-blue"
                onClick={onCreateFriendRoom}
              >
                <Plus size={16} />
                <span>Create Room</span>
              </button>

              <button
                type="button"
                className="friend-pill-btn btn-outline-blue"
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
              className="inline-code-input"
              placeholder="e.g. PV-8291"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="inline-join-submit-btn">
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
      <section className="dash-mode-card matchmaking-mode-card">
        <div className="mode-card-top-bar">
          <div className="mode-card-main-row">
            {/* App Icon Square with Sparkles */}
            <div className="app-icon-wrap">
              <span className="spark spark-tl" />
              <span className="spark spark-bl" />
              <div className="app-icon-box amber-icon-box">
                <Globe size={24} color="#FFFFFF" />
              </div>
            </div>

            {/* Text Content */}
            <div className="mode-card-text">
              <h3 className="mode-card-title">Quick Matchmaking</h3>
              <p className="mode-card-desc">
                Find an online opponent and compete in ranked 1v1 matches.
              </p>
            </div>
          </div>

          {/* Top Right Ranked Badge */}
          <div className="ranked-status-pill">
            <span>★ Official Ranked 1v1</span>
          </div>
        </div>

        {/* Wide Full-Width Bottom Action Button */}
        <div className="mode-card-bottom-row">
          {user.isGuest ? (
            <button
              type="button"
              className="wide-action-btn guest-login-match-btn"
              onClick={onOpenAuth}
            >
              <Lock size={16} />
              <span>Login to Find Match</span>
              <ChevronRight size={17} className="btn-chevron-right" />
            </button>
          ) : (
            <button
              type="button"
              className="wide-action-btn live-find-match-btn"
              onClick={onStartMatchmaking}
            >
              <Zap size={16} fill="#FFF" />
              <span>Find Online Match</span>
              <ChevronRight size={17} className="btn-chevron-right" />
            </button>
          )}
        </div>
      </section>

      {/* ─── CARD 5: PLAY WITH BOT ─── */}
      <section className="dash-mode-card bot-mode-card">
        <div className="mode-card-top-bar">
          <div className="mode-card-main-row">
            {/* App Icon Square with Sparkles */}
            <div className="app-icon-wrap">
              <span className="spark spark-tl" />
              <span className="spark spark-tr" />
              <div className="app-icon-box orange-icon-box">
                <Bot size={25} color="#FFFFFF" />
              </div>
            </div>

            {/* Text Content */}
            <div className="mode-card-text">
              <h3 className="mode-card-title">Play with Bot</h3>
              <p className="mode-card-desc">
                Test your skills offline against our heuristic AI.
              </p>
            </div>
          </div>

          {/* Difficulty Selector Pills */}
          <div className="bot-diff-strip">
            <button
              type="button"
              className={`diff-pill-btn ${selectedBotDiff === 'casual' ? 'is-active' : ''}`}
              onClick={() => setSelectedBotDiff('casual')}
            >
              Casual
            </button>
            <button
              type="button"
              className={`diff-pill-btn ${selectedBotDiff === 'tactical' ? 'is-active' : ''}`}
              onClick={() => setSelectedBotDiff('tactical')}
            >
              Tactical
            </button>
            <button
              type="button"
              className={`diff-pill-btn diff-insane-btn ${selectedBotDiff === 'insane' ? 'is-active' : ''}`}
              onClick={() => setSelectedBotDiff('insane')}
            >
              <Flame size={13} className="flame-icon" />
              <span>Insane IQ</span>
              <Crown size={12} className="crown-icon" />
            </button>
          </div>
        </div>

        {/* Wide Full-Width Orange Bottom Play Button */}
        <div className="mode-card-bottom-row">
          <button
            type="button"
            className="wide-action-btn play-bot-cta-btn"
            onClick={() => onStartBotGame(selectedBotDiff)}
          >
            <Play size={16} fill="#FFFFFF" />
            <span>Play vs {selectedBotDiff.toUpperCase()} Bot</span>
          </button>
        </div>

        {/* Faint Desert Dunes Watermark Illustration at Bottom */}
        <svg
          className="bot-dunes-watermark"
          viewBox="0 0 500 65"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 45 Q 80 15, 170 38 T 350 20 T 500 45 L 500 65 L 0 65 Z"
            fill="rgba(251, 146, 60, 0.08)"
          />
          <path
            d="M0 52 Q 110 32, 230 46 T 430 35 T 500 55 L 500 65 L 0 65 Z"
            fill="rgba(234, 88, 12, 0.06)"
          />
        </svg>
      </section>
    </div>
  )
}

