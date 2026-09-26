import React, { useState, useEffect } from 'react'
import { X, Copy, Check, Share2, Users, Search, Sparkles, MessageCircle, Bot, Zap, Swords } from 'lucide-react'
import { sounds } from '../utils/audio'

export default function MultiplayerModal({
  isOpen,
  onClose,
  type, // 'create_room' | 'matchmaking'
  roomCode,
  selectedGame = 'poojyam',
  onStartSimulatedMatch,
  queueStatus,
}) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [searchTimer, setSearchTimer] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      setSearchTimer(0)
      return
    }
    const timer = setInterval(() => {
      setSearchTimer((t) => t + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isOpen])

  if (!isOpen) return null

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${roomCode}&game=${selectedGame}`
    : `https://game.dev/?room=${roomCode}&game=${selectedGame}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleWhatsAppShare = () => {
    const gameLabel = selectedGame === 'quick' ? 'Quick Vettu (3x3)' : 'Poojyam Vettu (55-Dots)'
    const text = encodeURIComponent(`Let's play 1v1 ${gameLabel}! Click here to join my room: ${inviteUrl} (Code: ${roomCode})`)
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
  }

  return (
    <div className="creamy-modal-overlay" onClick={onClose}>
      <div className="creamy-modal-content mp-modal-box" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close-btn"
          onClick={(e) => {
            e.stopPropagation()
            onClose?.()
          }}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {type === 'create_room' ? (
          <div className="room-create-body">
            <div className="mp-icon-badge blue-pulse">
              <Users size={32} color="#2563EB" />
            </div>

            <h2 className="mp-modal-title">1v1 Friend Room Created</h2>
            <p className="mp-modal-sub">
              Share this room code or direct link with your friend to start playing together!
            </p>

            {/* Room Code Display */}
            <div className="room-code-display-card">
              <span className="code-label">ROOM CODE</span>
              <div className="code-value-row">
                <span className="code-text">{roomCode}</span>
                <button
                  type="button"
                  className="code-copy-btn"
                  onClick={handleCopyCode}
                  title="Copy Code"
                >
                  {copiedCode ? <Check size={18} color="#16A34A" /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            {/* Direct Link Share */}
            <div className="invite-link-box">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="creamy-input invite-input"
              />
              <button
                type="button"
                className="creamy-btn btn-blue copy-link-btn"
                onClick={handleCopyLink}
              >
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Social Share Buttons */}
            <div className="social-share-strip">
              <button
                type="button"
                className="creamy-btn whatsapp-btn"
                onClick={handleWhatsAppShare}
              >
                <MessageCircle size={18} />
                <span>Share via WhatsApp</span>
              </button>
            </div>

            {/* Waiting Pulse */}
            <div className="waiting-status-wrap">
              <div className="waiting-spinner" />
              <span>Waiting for your friend to enter the room...</span>
            </div>
          </div>
        ) : (
          <div className="matchmaking-body">
            <div className="radar-animation-box magnifier-search-box">
              <div className="radar-circle rc-1" />
              <div className="radar-circle rc-2" />
              <div className="radar-circle rc-3" />
              <div className="radar-center-dot magnifier-center-dot">
                <Search size={28} color="#FFF" className="magnifier-scan-anim" />
              </div>
            </div>

            <h2 className="mp-modal-title">
              {queueStatus?.state === 'matched' ? 'Opponent Matched!' : 'Searching for Opponent...'}
            </h2>
            <p className="mp-modal-sub">
              {queueStatus?.message || 'Scanning the network for an available 1v1 challenger...'}
            </p>

            <div className="match-stats-row">
              <div className="m-stat">
                <span className="m-val">{searchTimer}s</span>
                <span className="m-lbl">Searching</span>
              </div>
              <div className="m-stat">
                <span className="m-val">{selectedGame === 'quick' ? '3x3 Quick' : '55-Dots'}</span>
                <span className="m-lbl">Game Mode</span>
              </div>
              <div className="m-stat">
                <span className="m-val live-ping-val">
                  <span className="live-dot" /> Live
                </span>
                <span className="m-lbl">Cloud Pool</span>
              </div>
            </div>

            <button
              type="button"
              className="creamy-btn cancel-search-btn"
              onClick={onClose}
            >
              Cancel Search
            </button>

            {searchTimer >= 8 && (
              <div className="instant-challenger-prompt">
                <p>Taking a bit longer? Practice with a live Challenger bot:</p>
                <button
                  type="button"
                  className="creamy-btn btn-primary instant-match-btn"
                  onClick={onStartSimulatedMatch}
                >
                  <Bot size={18} />
                  <span>Duel AI Challenger (Sneha_Thrissur)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
