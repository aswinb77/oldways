import React, { useState, useEffect, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { RotateCcw, Volume2, Sparkles, Trophy, Flame, Flag, MessageSquare } from 'lucide-react'
import {
  N,
  TOTAL_DOTS,
  pos,
  createEmptyGrid,
  checkNewCuts,
  getAiMove,
  ALL_LINES,
} from './poojyamVettuLogic'
import { sounds } from '../../utils/audio'

export default function PoojyamVettuBoard({
  mode = 'bot', // 'bot' | 'friend' | 'matchmaking'
  botDifficulty = 'insane',
  currentUser,
  opponentProfile,
  isHost = true,
  onSendAction,
  lastRemoteAction,
  onGameOver,
}) {
  const [grid, setGrid] = useState(createEmptyGrid)
  const [curPlayer, setCurPlayer] = useState(0) // 0 = Player 1 (Red X), 1 = Player 2 (Blue X)
  const [scores, setScores] = useState([0, 0])
  const [completedLines, setCompletedLines] = useState([])
  const [hoveredDot, setHoveredDot] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [lastMove, setLastMove] = useState(null)
  const [tauntMsg, setTauntMsg] = useState(null)

  const myPlayerIndex = mode === 'bot' ? 0 : isHost ? 0 : 1
  const isMyTurn = curPlayer === myPlayerIndex

  // Completed lines set for fast lookup
  const completedLineSet = useMemo(() => {
    return new Set(completedLines.map((cl) => cl.lineIdx))
  }, [completedLines])

  // Count placed dots
  const placedCount = useMemo(() => {
    let count = 0
    grid.forEach((row) => row.forEach((cell) => { if (cell !== null) count++ }))
    return count
  }, [grid])

  // Core move execution
  const executeMove = useCallback((r, c, player) => {
    setGrid((prev) => {
      const next = prev.map((row) => [...row])
      next[r][c] = player
      return next
    })

    setLastMove([r, c])
    sounds.playDot()

    // Check line completions
    const currentCompleted = new Set(completedLines.map((l) => l.lineIdx))
    // Virtual grid with the new move applied
    const virtualGrid = grid.map((row, vr) =>
      row.map((cell, vc) => (vr === r && vc === c ? player : cell))
    )

    const { newCuts, pointsEarned } = checkNewCuts(virtualGrid, currentCompleted, r, c, player)

    if (newCuts.length > 0) {
      sounds.playCut()
      setCompletedLines((prev) => [...prev, ...newCuts])
      setScores((prev) => {
        const updated = [...prev]
        updated[player] += pointsEarned
        return updated
      })
    }

    // Switch turn
    const nextPlayer = player === 0 ? 1 : 0
    setCurPlayer(nextPlayer)
  }, [grid, completedLines])

  // Check end of game
  useEffect(() => {
    if (placedCount === TOTAL_DOTS && !gameResult) {
      let result = null
      if (scores[0] > scores[1]) {
        result = {
          winner: 0,
          title: myPlayerIndex === 0 ? '🏆 Victory! You Won!' : 'Defeat! Opponent Won',
          type: myPlayerIndex === 0 ? 'win' : 'loss',
        }
      } else if (scores[1] > scores[0]) {
        result = {
          winner: 1,
          title: myPlayerIndex === 1 ? '🏆 Victory! You Won!' : 'Defeat! Opponent Won',
          type: myPlayerIndex === 1 ? 'win' : 'loss',
        }
      } else {
        result = {
          winner: 'tie',
          title: '🤝 Dramatic Tie Match!',
          type: 'tie',
        }
      }

      setGameResult(result)

      if (result.winner === myPlayerIndex) {
        sounds.playWin()
        confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } })
        onGameOver && onGameOver({ isWin: true, scoreDiff: Math.abs(scores[0] - scores[1]) })
      } else {
        sounds.playOver()
        onGameOver && onGameOver({ isWin: false, scoreDiff: Math.abs(scores[0] - scores[1]) })
      }
    }
  }, [placedCount, scores, gameResult, myPlayerIndex, onGameOver])

  // Handle human click on a dot
  const handleDotClick = (r, c) => {
    if (gameResult) return
    if (grid[r][c] !== null) return
    if (!isMyTurn) return

    executeMove(r, c, myPlayerIndex)

    // Send to remote player if 1v1 online
    if (mode !== 'bot' && onSendAction) {
      onSendAction({
        type: 'MOVE',
        r,
        c,
        player: myPlayerIndex,
      })
    }
  }

  // Handle incoming remote action from multiplayer
  useEffect(() => {
    if (!lastRemoteAction) return

    if (lastRemoteAction.type === 'MOVE') {
      const { r, c, player } = lastRemoteAction
      if (grid[r] && grid[r][c] === null) {
        executeMove(r, c, player)
      }
    } else if (lastRemoteAction.type === 'RESTART') {
      resetGame()
    } else if (lastRemoteAction.type === 'TAUNT') {
      setTauntMsg(lastRemoteAction.text)
      setTimeout(() => setTauntMsg(null), 3000)
    }
  }, [lastRemoteAction])

  // Handle Bot Turn
  useEffect(() => {
    if (mode !== 'bot') return
    if (curPlayer !== 1) return
    if (placedCount >= TOTAL_DOTS) return
    if (gameResult) return

    setIsBotThinking(true)
    const delay = botDifficulty === 'casual' ? 600 : 750

    const timer = setTimeout(() => {
      const aiMove = getAiMove(grid, completedLineSet, botDifficulty, lastMove)
      if (aiMove) {
        executeMove(aiMove[0], aiMove[1], 1)
      }
      setIsBotThinking(false)
    }, delay)

    return () => clearTimeout(timer)
  }, [curPlayer, mode, grid, completedLineSet, botDifficulty, lastMove, placedCount, gameResult, executeMove])

  // Reset Game
  const resetGame = () => {
    setGrid(createEmptyGrid())
    setCurPlayer(0)
    setScores([0, 0])
    setCompletedLines([])
    setGameResult(null)
    setLastMove(null)
    setIsBotThinking(false)
    if (mode !== 'bot' && onSendAction) {
      onSendAction({ type: 'RESTART' })
    }
  }

  // Send Taunt
  const handleSendTaunt = (msg) => {
    setTauntMsg(msg)
    setTimeout(() => setTauntMsg(null), 3000)
    if (onSendAction) {
      onSendAction({ type: 'TAUNT', text: msg })
    }
  }

  const p1Name = isHost ? currentUser.username : (opponentProfile?.username || 'Host Player')
  const p1Avatar = isHost ? currentUser.avatar : (opponentProfile?.avatar || '/assets/aswin-avatar.png')

  const p2Name = mode === 'bot'
    ? `Bot (${botDifficulty.toUpperCase()})`
    : !isHost
    ? currentUser.username
    : (opponentProfile?.username || 'Challenger')

  const p2Avatar = mode === 'bot'
    ? '/assets/catlook.png'
    : !isHost
    ? currentUser.avatar
    : (opponentProfile?.avatar || '/assets/shield-code-blue.png')

  return (
    <div className="poojyam-board-wrapper">
      {/* Scoreboard Bar */}
      <div className="creamy-card board-scoreboard-card">
        {/* Player 1 (Red X) */}
        <div className={`scoreboard-player p1-box ${curPlayer === 0 ? 'is-active-turn' : ''}`}>
          <div className="player-avatar-badge">
            <img src={p1Avatar} alt={p1Name} className="player-img" />
            <img src="/assets/vettu-x-red.png" alt="X" className="piece-indicator-icon" />
          </div>
          <div className="player-details">
            <span className="player-title-name">
              {p1Name} {myPlayerIndex === 0 ? '(You)' : ''}
            </span>
            <div className="score-counter p1-score">{scores[0]} pts</div>
          </div>
          {curPlayer === 0 && (
            <div className="turn-pulse-badge red-pulse">
              <span>TURN</span>
            </div>
          )}
        </div>

        {/* Center Divider / Dots Left */}
        <div className="scoreboard-center">
          <div className="dots-remaining-pill">
            <span>{TOTAL_DOTS - placedCount}</span>
            <span className="pill-sub">dots left</span>
          </div>
          {isBotThinking && (
            <div className="bot-thinking-pill">
              <Sparkles size={13} className="spin-anim" />
              <span>Thinking...</span>
            </div>
          )}
          {tauntMsg && (
            <div className="live-taunt-bubble">
              <span>{tauntMsg}</span>
            </div>
          )}
        </div>

        {/* Player 2 (Blue X) */}
        <div className={`scoreboard-player p2-box ${curPlayer === 1 ? 'is-active-turn' : ''}`}>
          {curPlayer === 1 && (
            <div className="turn-pulse-badge blue-pulse">
              <span>TURN</span>
            </div>
          )}
          <div className="player-details text-right">
            <span className="player-title-name">
              {p2Name} {myPlayerIndex === 1 ? '(You)' : ''}
            </span>
            <div className="score-counter p2-score">{scores[1]} pts</div>
          </div>
          <div className="player-avatar-badge">
            <img src={p2Avatar} alt={p2Name} className="player-img" />
            <img src="/assets/vettu-x-blue.png" alt="O" className="piece-indicator-icon" />
          </div>
        </div>
      </div>

      {/* Kerala School Notebook Paper Card Game Arena */}
      <div className="creamy-card board-canvas-card">
        {/* Paperclip Nostalgia Badge */}
        <div className="paperclip-visual" aria-hidden="true">
          <svg viewBox="0 0 28 68" width="22" height="54" fill="none">
            <defs>
              <linearGradient id="clip-steel" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d1d5db" />
                <stop offset="40%" stopColor="#ffffff" />
                <stop offset="70%" stopColor="#9ca3af" />
                <stop offset="100%" stopColor="#d1d5db" />
              </linearGradient>
            </defs>
            <path
              d="M9 16v34a5 5 0 0 0 10 0V12a8 8 0 0 0-16 0v40a10 10 0 0 0 20 0V18"
              stroke="rgba(60, 40, 25, 0.25)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(1.5, 2)"
            />
            <path
              d="M9 16v34a5 5 0 0 0 10 0V12a8 8 0 0 0-16 0v40a10 10 0 0 0 20 0V18"
              stroke="url(#clip-steel)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Board Title Header */}
        <div className="canvas-header-title">
          <h2 className="canvas-title">Poojyam Vettu</h2>
          <span className="canvas-malayalam">പൂജ്യം വെട്ട് കളിക്കുന്നോ ?</span>
        </div>

        {/* 55-Dot Triangular SVG Canvas */}
        <div className="svg-container-wrap">
          <svg
            viewBox="0 0 440 440"
            className="poojyam-svg-board"
            aria-label="Poojyam Vettu Game Board"
          >
            {/* 1. Base Interactive Slots */}
            <g className="board-slot-nodes">
              {Array.from({ length: N }).map((_, r) =>
                Array.from({ length: r + 1 }).map((__, c) => {
                  const [x, y] = pos(r, c)
                  const isClaimed = grid[r][c] !== null
                  const isHovered = hoveredDot && hoveredDot[0] === r && hoveredDot[1] === c

                  return (
                    <g
                      key={`slot_${r}_${c}`}
                      className={`board-dot-cell ${isClaimed ? 'is-claimed' : 'is-open'}`}
                      onClick={() => handleDotClick(r, c)}
                      onMouseEnter={() => !isClaimed && isMyTurn && setHoveredDot([r, c])}
                      onMouseLeave={() => setHoveredDot(null)}
                    >
                      {/* Generous Hitbox */}
                      <circle
                        cx={x}
                        cy={y}
                        r={19}
                        fill="transparent"
                        cursor={isClaimed || !isMyTurn ? 'default' : 'pointer'}
                      />

                      {/* Tactile Slot Asset */}
                      <image
                        href={isClaimed || isHovered ? '/assets/vettu-slot-filled.png' : '/assets/vettu-slot-empty.png'}
                        x={x - 17}
                        y={y - 17}
                        width="34"
                        height="34"
                        className={`slot-img ${isHovered && !isClaimed ? 'is-hovered' : ''}`}
                        pointerEvents="none"
                      />

                      {/* Ghost preview of active player on hover */}
                      {!isClaimed && isHovered && isMyTurn && (
                        <image
                          href={curPlayer === 0 ? '/assets/vettu-x-red.png' : '/assets/vettu-x-blue.png'}
                          x={x - 15}
                          y={y - 15}
                          width="30"
                          height="30"
                          opacity="0.5"
                          className="ghost-mark"
                          pointerEvents="none"
                        />
                      )}
                    </g>
                  )
                })
              )}
            </g>

            {/* 2. Placed Marks (X Red & X Blue) */}
            <g className="board-placed-crosses">
              {grid.map((row, r) =>
                row.map((owner, c) => {
                  if (owner === null) return null
                  const [x, y] = pos(r, c)
                  return (
                    <image
                      key={`placed_${r}_${c}`}
                      href={owner === 0 ? '/assets/vettu-x-red.png' : '/assets/vettu-x-blue.png'}
                      x={x - 16}
                      y={y - 16}
                      width="32"
                      height="32"
                      className="placed-x-mark"
                      pointerEvents="none"
                    />
                  )
                })
              )}
            </g>

            {/* 3. Razor-Sharp Solid Cut Slashes */}
            <g className="board-cut-lines">
              {completedLines.map((cl, idx) => (
                <line
                  key={`cut_${idx}`}
                  x1={cl.x1}
                  y1={cl.y1}
                  x2={cl.x2}
                  y2={cl.y2}
                  stroke={cl.player === 0 ? '#E04838' : '#1D6AE5'}
                  strokeWidth="4.8"
                  strokeLinecap="round"
                  className="razor-cut-anim"
                />
              ))}
            </g>
          </svg>
        </div>

        {/* Quick Taunt / Reaction Drawer */}
        <div className="taunt-strip">
          <span className="taunt-label">
            <MessageSquare size={13} />
            Quick Taunts:
          </span>
          {['പൊളിച്ചു! 🔥', 'അയ്യോ! 😱', 'Nice Cut! ✂️', 'ഇനി ഞാൻ ജയിക്കും! 👑', 'GG WP 🤝'].map((text) => (
            <button
              key={text}
              type="button"
              className="taunt-btn"
              onClick={() => handleSendTaunt(text)}
            >
              {text}
            </button>
          ))}
        </div>

        {/* Controls Footer */}
        <div className="board-controls-bar">
          <button type="button" className="creamy-btn" onClick={resetGame}>
            <RotateCcw size={16} />
            <span>Reset Board</span>
          </button>
        </div>

        {/* End Game Modal Overlay */}
        {gameResult && (
          <div className="board-modal-overlay">
            <div className={`creamy-card result-modal-card is-${gameResult.type}`}>
              <div className="result-icon-badge">
                {gameResult.type === 'win' ? '🏆' : gameResult.type === 'loss' ? '💔' : '🤝'}
              </div>
              <h3 className="result-title">{gameResult.title}</h3>
              <p className="result-sub">
                {gameResult.type === 'win'
                  ? 'Awesome strategy! All lines scored.'
                  : 'Well played match! Ready for a rematch?'}
              </p>

              <div className="result-scores-box">
                <div className="score-team">
                  <img src="/assets/vettu-x-red.png" alt="Red" />
                  <span className="team-score">{scores[0]} pts</span>
                  <span className="team-name">{p1Name}</span>
                </div>
                <div className="score-vs">:</div>
                <div className="score-team">
                  <img src="/assets/vettu-x-blue.png" alt="Blue" />
                  <span className="team-score">{scores[1]} pts</span>
                  <span className="team-name">{p2Name}</span>
                </div>
              </div>

              {!currentUser.isGuest && gameResult.type === 'win' && (
                <div className="leaderboard-earned-notice">
                  <Sparkles size={16} color="#D97706" />
                  <span>
                    <strong>+25 Weekly Points</strong> earned and added to the Leaderboard!
                  </span>
                </div>
              )}

              <button
                type="button"
                className="creamy-btn btn-primary rematch-btn"
                onClick={resetGame}
              >
                <RotateCcw size={17} />
                <span>Play Again (കളിക്കാം)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
