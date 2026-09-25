import React, { useState, useEffect } from 'react'
import { Trophy, Flame, Medal, Clock, ShieldCheck, Sparkles, LogIn } from 'lucide-react'
import { loadLeaderboard, getWeeklyResetTime } from '../utils/userStore'

export default function Leaderboard({ user, onOpenAuth }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    setLeaderboard(loadLeaderboard())
    setTimeLeft(getWeeklyResetTime())

    const interval = setInterval(() => {
      setTimeLeft(getWeeklyResetTime())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const topThree = leaderboard.slice(0, 3)
  const restList = leaderboard.slice(3)

  return (
    <div className="leaderboard-view">
      {/* Header Banner */}
      <div className="creamy-card leaderboard-banner">
        <div className="banner-badge">
          <Trophy size={36} color="#E69D00" />
        </div>
        <div className="banner-content">
          <div className="banner-title-row">
            <h1 className="banner-title">Weekly Arena Leaderboard</h1>
            <div className="reset-pill">
              <Clock size={15} />
              <span>Resets in: <strong>{timeLeft}</strong></span>
            </div>
          </div>
          <p className="banner-desc">
            Compete in 1v1 Quick Matchmaking and Online Friend duels! Logged-in players earn 
            <strong> +25 pts</strong> per win to claim the weekly crown.
          </p>
        </div>
      </div>

      {/* Guest Notice if user is not logged in */}
      {user.isGuest && (
        <div className="leaderboard-guest-banner">
          <div className="guest-banner-left">
            <Sparkles size={20} color="#D97706" />
            <div>
              <strong>Playing as Guest ({user.username})</strong>
              <p>Your wins are not recorded on the Weekly Leaderboard. Log in to start earning points!</p>
            </div>
          </div>
          <button
            type="button"
            className="creamy-btn btn-primary"
            onClick={onOpenAuth}
          >
            <LogIn size={16} />
            <span>Login to Qualify</span>
          </button>
        </div>
      )}

      {/* Top 3 Podium */}
      {topThree.length >= 3 && (
        <div className="podium-grid">
          {/* 2nd Place */}
          <div className="podium-col rank-2">
            <div className="podium-avatar-wrap">
              <span className="medal-badge silver">🥈 2nd</span>
              <img src={topThree[1].avatar} alt={topThree[1].username} className="podium-avatar" />
            </div>
            <div className="podium-info">
              <h3 className="podium-name">{topThree[1].username}</h3>
              <div className="podium-score">{topThree[1].points} pts</div>
              <span className="podium-wins">{topThree[1].wins} Wins</span>
            </div>
            <div className="podium-pedestal p-2">2</div>
          </div>

          {/* 1st Place */}
          <div className="podium-col rank-1">
            <div className="crown-icon">👑</div>
            <div className="podium-avatar-wrap">
              <span className="medal-badge gold">🥇 1st</span>
              <img src={topThree[0].avatar} alt={topThree[0].username} className="podium-avatar champ" />
            </div>
            <div className="podium-info">
              <h3 className="podium-name">{topThree[0].username}</h3>
              <div className="podium-score gold-score">{topThree[0].points} pts</div>
              <span className="podium-wins">{topThree[0].wins} Wins</span>
            </div>
            <div className="podium-pedestal p-1">1</div>
          </div>

          {/* 3rd Place */}
          <div className="podium-col rank-3">
            <div className="podium-avatar-wrap">
              <span className="medal-badge bronze">🥉 3rd</span>
              <img src={topThree[2].avatar} alt={topThree[2].username} className="podium-avatar" />
            </div>
            <div className="podium-info">
              <h3 className="podium-name">{topThree[2].username}</h3>
              <div className="podium-score">{topThree[2].points} pts</div>
              <span className="podium-wins">{topThree[2].wins} Wins</span>
            </div>
            <div className="podium-pedestal p-3">3</div>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="creamy-card leaderboard-table-card">
        <div className="table-header-title">
          <h2>Top Contenders</h2>
          <span className="table-sub">Live weekly rankings updated after every match</span>
        </div>

        <div className="leaderboard-table">
          <div className="table-row head-row">
            <span className="col-rank">#</span>
            <span className="col-player">Player</span>
            <span className="col-tier">Tier</span>
            <span className="col-wins">Wins</span>
            <span className="col-streak">Streak</span>
            <span className="col-points">Weekly Score</span>
          </div>

          {leaderboard.map((player) => {
            const isMe = !user.isGuest && player.id === user.id
            return (
              <div
                key={player.id || player.rank}
                className={`table-row ${isMe ? 'is-current-user' : ''}`}
              >
                <span className="col-rank font-bold">
                  {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `#${player.rank}`}
                </span>

                <div className="col-player player-cell">
                  <img src={player.avatar} alt={player.username} className="cell-avatar" />
                  <div className="cell-player-info">
                    <span className="player-handle">{player.username}</span>
                    {isMe && <span className="you-pill">YOU</span>}
                  </div>
                </div>

                <div className="col-tier">
                  <span className={`tier-badge tier-${(player.badge || 'Gold').toLowerCase()}`}>
                    {player.badge || 'Gold'}
                  </span>
                </div>

                <span className="col-wins font-medium">{player.wins} W</span>

                <div className="col-streak">
                  {player.streak > 0 ? (
                    <span className="streak-pill">
                      <Flame size={13} color="#E04838" />
                      {player.streak}
                    </span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </div>

                <div className="col-points font-bold">
                  <span className="points-num">{player.points}</span>
                  <span className="points-unit">pts</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Scoring Rules Footer */}
        <div className="scoring-rules-footer">
          <h4>How are Weekly Points Calculated?</h4>
          <div className="rules-grid">
            <div className="rule-card">
              <span className="rule-pts">+25 pts</span>
              <span className="rule-label">1v1 Online Matchmaking Win</span>
            </div>
            <div className="rule-card">
              <span className="rule-pts">+15 pts</span>
              <span className="rule-label">1v1 Friend Room Duel Win</span>
            </div>
            <div className="rule-card">
              <span className="rule-pts">+10 pts</span>
              <span className="rule-label">Defeating Insane IQ Bot</span>
            </div>
            <div className="rule-card">
              <span className="rule-pts">+5 pts</span>
              <span className="rule-label">Dominance Bonus (40+ pt lead)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
