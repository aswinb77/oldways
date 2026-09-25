import React, { useState } from 'react'
import { Sparkles, ArrowRight, RefreshCw, Check } from 'lucide-react'
import { DEFAULT_AVATARS, getRandomAvatar, saveUser } from '../utils/userStore'

export default function JoinRoomModal({
  isOpen,
  roomCode,
  currentUser,
  onJoinConfirmed,
}) {
  const [friendName, setFriendName] = useState(
    currentUser.isGuest && currentUser.username.startsWith('Guest_')
      ? ''
      : currentUser.username
  )
  const [selectedAvatar, setSelectedAvatar] = useState(
    currentUser.avatar || getRandomAvatar()
  )

  if (!isOpen) return null

  const handleShuffleAvatar = () => {
    setSelectedAvatar(getRandomAvatar())
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const finalName = friendName.trim() || `Player_${Math.floor(100 + Math.random() * 900)}`
    const updatedUser = {
      ...currentUser,
      username: finalName,
      avatar: selectedAvatar,
    }
    saveUser(updatedUser)
    onJoinConfirmed(updatedUser)
  }

  return (
    <div className="creamy-modal-overlay">
      <div className="creamy-modal-content join-room-modal-box">
        {/* Header */}
        <div className="join-room-badge">
          <Sparkles size={28} color="#2563EB" />
        </div>

        <h2 className="join-room-title">1v1 Duel Invitation! ⚔️</h2>
        <p className="join-room-subtitle">
          Your friend invited you to play a 1v1 match in room <strong>{roomCode}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="join-room-form">
          {/* Default Avatar with Shuffle Option */}
          <div className="join-avatar-section">
            <span className="join-avatar-label">Your Match Avatar</span>
            <div className="join-avatar-preview-wrap">
              <img src={selectedAvatar} alt="Your Avatar" className="join-preview-img" />
              <button
                type="button"
                className="avatar-shuffle-btn"
                onClick={handleShuffleAvatar}
                title="Change Avatar"
              >
                <RefreshCw size={15} />
              </button>
            </div>
            {/* Quick row of alternative avatars */}
            <div className="mini-avatar-picker">
              {DEFAULT_AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  className={`mini-av-btn ${selectedAvatar === av.src ? 'is-active' : ''}`}
                  onClick={() => setSelectedAvatar(av.src)}
                >
                  <img src={av.src} alt={av.name} />
                  {selectedAvatar === av.src && (
                    <div className="mini-av-check">
                      <Check size={10} color="#FFF" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Name Input */}
          <div className="form-group text-left">
            <label className="auth-label">Enter Your Name</label>
            <input
              type="text"
              className="creamy-input join-name-input"
              placeholder="e.g. Rahul, Sneha, Aswin..."
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Submit */}
          <button type="submit" className="creamy-btn btn-primary join-submit-btn">
            <span>Enter Room & Play (കളിക്കാം!)</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}
