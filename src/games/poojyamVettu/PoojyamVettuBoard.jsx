import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import confetti from 'canvas-confetti'
import { RotateCcw, Volume2, Sparkles, Trophy, Flame, Flag, MessageSquare, AlertCircle, WifiOff, CheckCircle } from 'lucide-react'
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
import { saveRoomState, loadRoomState, clearRoomState } from '../../utils/userStore'

export default function PoojyamVettuBoard({
  mode = 'bot', // 'bot' | 'friend' | 'matchmaking'
  roomCode = '',
  botDifficulty = 'insane',
  currentUser,
  opponentProfile,
  isHost = true,
  isOpponentDisconnected = false,
  onSendAction,
  lastRemoteAction,
  onGameOver,
}) {
  // Check if a saved paused game exists for this room
  const savedInitialState = useMemo(() => {
    if (mode === 'friend' && roomCode) {
      const saved = loadRoomState(roomCode)
      if (saved && saved.grid) {
        return saved
      }
    }
    return null
  }, [mode, roomCode])

  const [grid, setGrid] = useState(() => savedInitialState?.grid || createEmptyGrid())
  const [curPlayer, setCurPlayer] = useState(() => savedInitialState?.curPlayer || 0) // 0 = P1 (Red X), 1 = P2 (Blue X)
  const [scores, setScores] = useState(() => savedInitialState?.scores || [0, 0])
  const [completedLines, setCompletedLines] = useState(() => savedInitialState?.completedLines || [])
  const [hoveredDot, setHoveredDot] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [lastMove, setLastMove] = useState(() => savedInitialState?.lastMove || null)
  const [tauntMsg, setTauntMsg] = useState(null)
  const [reconnectBanner, setReconnectBanner] = useState(false)
  const [pendingResetOutgoing, setPendingResetOutgoing] = useState(false)
  const [pendingResetIncoming, setPendingResetIncoming] = useState(null)
  const [resetNotice, setResetNotice] = useState(null)

  const myPlayerIndex = mode === 'bot' ? 0 : isHost ? 0 : 1
  const isMyTurn = curPlayer === myPlayerIndex

  // When room reconnects, if we are host, broadcast our state to ensure guest has exact board
  useEffect(() => {
    if (mode === 'friend' && isHost && onSendAction) {
      onSendAction({
        type: 'STATE_SYNC',
        state: { grid, scores, completedLines, curPlayer, lastMove },
      })
    }
  }, [opponentProfile])

  // Save room state locally on any move/cut so refreshes/cutoffs resume perfectly
  useEffect(() => {
    if (mode === 'friend' && roomCode && !gameResult) {
      saveRoomState(roomCode, {
        grid,
        scores,
        completedLines,
        curPlayer,
        lastMove,
      })
    }
  }, [grid, scores, completedLines, curPlayer, lastMove, mode, roomCode, gameResult])

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
      if (roomCode) clearRoomState(roomCode)

      if (result.winner === myPlayerIndex) {
        sounds.playWin()
        confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } })
        onGameOver && onGameOver({ isWin: true, scoreDiff: Math.abs(scores[0] - scores[1]) })
      } else {
        sounds.playOver()
        onGameOver && onGameOver({ isWin: false, scoreDiff: Math.abs(scores[0] - scores[1]) })
      }
    }
  }, [placedCount, scores, gameResult, myPlayerIndex, onGameOver, roomCode])

  // Handle human click on a dot
  const handleDotClick = (r, c) => {
    setHoveredDot(null)
    if (gameResult) return
    if (grid[r][c] !== null) return
    if (!isMyTurn) return
    if (isOpponentDisconnected) return // Pause while waiting for reconnect

    executeMove(r, c, myPlayerIndex)

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
    } else if (lastRemoteAction.type === 'STATE_SYNC') {
      // Synchronize exact paused board from host / peer
      if (lastRemoteAction.state) {
        const { grid: sGrid, scores: sScores, completedLines: sLines, curPlayer: sCur, lastMove: sLast } = lastRemoteAction.state
        if (sGrid) setGrid(sGrid)
        if (sScores) setScores(sScores)
        if (sLines) setCompletedLines(sLines)
        if (sCur !== undefined) setCurPlayer(sCur)
        if (sLast) setLastMove(sLast)
        setReconnectBanner(true)
        setTimeout(() => setReconnectBanner(false), 2500)
      }
    } else if (lastRemoteAction.type === 'RESTART') {
      resetGame(false)
    } else if (lastRemoteAction.type === 'RESET_REQUEST') {
      setPendingResetIncoming({ requestedBy: lastRemoteAction.requestedBy || 'Opponent' })
    } else if (lastRemoteAction.type === 'RESET_ACCEPTED') {
      setPendingResetOutgoing(false)
      setPendingResetIncoming(null)
      resetGame(false)
    } else if (lastRemoteAction.type === 'RESET_DECLINED') {
      setPendingResetOutgoing(false)
      setResetNotice('Opponent declined the reset request.')
      setTimeout(() => setResetNotice(null), 3500)
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
  const resetGame = (broadcast = true) => {
    setGrid(createEmptyGrid())
    setCurPlayer(0)
    setScores([0, 0])
    setCompletedLines([])
    setGameResult(null)
    setLastMove(null)
    setIsBotThinking(false)
    setPendingResetOutgoing(false)
    setPendingResetIncoming(null)
    if (roomCode) clearRoomState(roomCode)
    if (broadcast && mode !== 'bot' && onSendAction) {
      onSendAction({ type: 'RESTART' })
    }
  }

  // Handle Reset Button Click with Mutual Approval
  const handleResetClick = () => {
    if (mode === 'friend' && !gameResult && !isOpponentDisconnected) {
      setPendingResetOutgoing(true)
      if (onSendAction) {
        onSendAction({
          type: 'RESET_REQUEST',
          requestedBy: currentUser.username,
        })
      }
    } else {
      resetGame(true)
    }
  }

  const handleAcceptReset = () => {
    setPendingResetIncoming(null)
    resetGame(false)
    if (onSendAction) {
      onSendAction({ type: 'RESET_ACCEPTED' })
    }
  }

  const handleDeclineReset = () => {
    setPendingResetIncoming(null)
    if (onSendAction) {
      onSendAction({ type: 'RESET_DECLINED' })
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
  const p1Avatar = isHost ? currentUser.avatar : (opponentProfile?.avatar || '/assets/avatar-blue.png')

  const p2Name = mode === 'bot'
    ? `Bot (${botDifficulty.toUpperCase()})`
    : !isHost
    ? currentUser.username
    : (opponentProfile?.username || 'Challenger')

  const p2Avatar = mode === 'bot'
    ? '/assets/avatar-orange.png'
    : !isHost
    ? currentUser.avatar
    : (opponentProfile?.avatar || '/assets/avatar-red.png')

  return (
    <div className="poojyam-board-wrapper">
      {/* Opponent Disconnected / Reconnect Banner */}
      {isOpponentDisconnected && (
        <div className="reconnect-alert-banner">
          <WifiOff size={18} className="spin-slow" />
          <span>
            <strong>Friend temporarily disconnected.</strong> Game is paused — it will automatically resume as soon as they re-open the room link!
          </span>
        </div>
      )}

      {reconnectBanner && (
        <div className="reconnect-success-banner">
          <CheckCircle size={18} />
          <span>Game synchronized and resumed where you left off!</span>
        </div>
      )}

      {/* Scoreboard Bar */}
      <div className="creamy-card board-scoreboard-card">
        {/* Player 1 (Red X) */}
        <div className={`scoreboard-player p1-box ${curPlayer === 0 ? 'is-active-turn' : 'is-inactive-turn'}`}>
          <div className="player-avatar-badge">
            <img src={p1Avatar} alt={p1Name} className="player-img" />
            <img src="/assets/vettu-x-red.png" alt="X" className="piece-indicator-icon" />
            {curPlayer === 0 && <span className="avatar-pulse-ring ring-red" />}
          </div>
          <div className="player-details">
            <div className="player-title-row">
              <span className="player-title-name">
                {p1Name} {myPlayerIndex === 0 ? '(You)' : ''}
              </span>
              {curPlayer === 0 && (
                <span className="turn-pulse-badge red-pulse">
                  TURN
                </span>
              )}
            </div>
            <div className="score-counter p1-score">{scores[0]} pts</div>
          </div>
        </div>

        {/* Center Divider / Dots Count Only */}
        <div className="scoreboard-center">
          <div className="dots-remaining-pill">
            <span>{TOTAL_DOTS - placedCount}</span>
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
        <div className={`scoreboard-player p2-box ${curPlayer === 1 ? 'is-active-turn' : 'is-inactive-turn'}`}>
          <div className="player-details text-right">
            <div className="player-title-row justify-end">
              {curPlayer === 1 && (
                <span className="turn-pulse-badge blue-pulse">
                  TURN
                </span>
              )}
              <span className="player-title-name">
                {p2Name} {myPlayerIndex === 1 ? '(You)' : ''}
              </span>
            </div>
            <div className="score-counter p2-score">{scores[1]} pts</div>
          </div>
          <div className="player-avatar-badge">
            <img src={p2Avatar} alt={p2Name} className="player-img" />
            <img src="/assets/vettu-x-blue.png" alt="O" className="piece-indicator-icon" />
            {curPlayer === 1 && <span className="avatar-pulse-ring ring-blue" />}
          </div>
        </div>
      </div>

      {/* Kerala School Notebook Paper Card Game Arena */}
      <div className="creamy-card board-canvas-card">
        {/* Paperclip Nostalgia Badge */}
        <div className="paperclip-visual" aria-hidden="true">
          <svg viewBox="0 0 28 68" width="20" height="50" fill="none">
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

        {/* 55-Dot Triangular SVG Canvas with Mobile-Optimized Touch Hitboxes */}
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
                      onTouchStart={() => setHoveredDot(null)}
                      onMouseEnter={() => {
                        if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
                        if (!isClaimed && isMyTurn) setHoveredDot([r, c])
                      }}
                      onMouseLeave={() => setHoveredDot(null)}
                    >
                      {/* Generous Hitbox for touch screens */}
                      <circle
                        cx={x}
                        cy={y}
                        r={21}
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
                      {!isClaimed && isHovered && isMyTurn && !isOpponentDisconnected && (
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

        {/* Quick Taunt / Reaction Drawer (Horizontal Scroll on Mobile) */}
        <div className="taunt-strip">
          <span className="taunt-label">
            <MessageSquare size={13} />
            Taunts:
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

        {/* Reset Notice if opponent declined */}
        {resetNotice && (
          <div className="reset-notice-pill">
            <AlertCircle size={15} />
            <span>{resetNotice}</span>
          </div>
        )}

        {/* Controls Footer */}
        <div className="board-controls-bar">
          <button
            type="button"
            className="creamy-btn"
            onClick={handleResetClick}
            disabled={pendingResetOutgoing}
          >
            <RotateCcw size={16} className={pendingResetOutgoing ? 'spin-anim' : ''} />
            <span>
              {pendingResetOutgoing
                ? 'Waiting for approval...'
                : 'Reset Board'}
            </span>
          </button>
        </div>

        {/* Mutual Reset Incoming Request Modal */}
        {pendingResetIncoming && (
          <div className="board-modal-overlay">
            <div className="creamy-card reset-confirm-modal">
              <div className="reset-confirm-badge">🔄</div>
              <h3 className="reset-confirm-title">Reset Board Request</h3>
              <p className="reset-confirm-desc">
                <strong>{pendingResetIncoming.requestedBy}</strong> wants to reset the board. Do you agree?
              </p>
              <div className="reset-confirm-actions">
                <button
                  type="button"
                  className="creamy-btn btn-primary"
                  onClick={handleAcceptReset}
                >
                  Yes, Reset
                </button>
                <button
                  type="button"
                  className="creamy-btn"
                  onClick={handleDeclineReset}
                >
                  No, Keep Playing
                </button>
              </div>
            </div>
          </div>
        )}

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

              {!currentUser.isGuest && mode === 'matchmaking' && gameResult.type === 'win' && (
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
