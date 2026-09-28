import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'
import { RotateCcw, Sparkles, MessageSquare, WifiOff, Play, RefreshCw, CheckCircle, Info } from 'lucide-react'
import { checkQuickWinner, getQuickAiMove, QUICK_LINES } from './quickVettuLogic'
import { sounds } from '../../utils/audio'
import { saveRoomState, loadRoomState, clearRoomState, clearActive1v1Match, markRoomClosed } from '../../utils/userStore'
import { ASSETS, getAsset } from '../../utils/assets'

export default function QuickVettuBoard({
  mode = 'bot',
  roomCode = '',
  botDifficulty = 'insane',
  currentUser,
  opponentProfile,
  isHost = true,
  isOpponentDisconnected = false,
  onSendAction,
  lastRemoteAction,
  onGameOver,
  onExitToLobby,
}) {
  const [showConnInfo, setShowConnInfo] = useState(false)
  const savedState = useMemo(() => {
    if ((mode === 'friend' || mode === 'matchmaking') && roomCode) {
      const saved = loadRoomState(roomCode)
      if (saved && saved.quickBoard) return saved
    }
    return null
  }, [mode, roomCode])

  const [board, setBoard] = useState(() => savedState?.quickBoard || Array(9).fill(null))
  const [curPlayer, setCurPlayer] = useState(() => savedState?.curPlayer || 0) // 0 = Red X, 1 = Blue X
  const [winningLine, setWinningLine] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [returnCountdown, setReturnCountdown] = useState(null)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [tauntData, setTauntData] = useState(null)
  const tauntTimerRef = useRef(null)
  const [reconnectBanner, setReconnectBanner] = useState(false)
  const [pendingResetOutgoing, setPendingResetOutgoing] = useState(false)
  const [pendingResetIncoming, setPendingResetIncoming] = useState(null)
  const [resetNotice, setResetNotice] = useState(null)
  const [showRejoinChoice, setShowRejoinChoice] = useState(false)
  const [disconnectCountdown, setDisconnectCountdown] = useState(20)
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(35)
  const prevDisconnectedRef = useRef(isOpponentDisconnected)
  const isGameOverHandledRef = useRef(false)

  // Clean up any active confetti on unmount / navigation to Lobby
  useEffect(() => {
    return () => {
      try {
        confetti.reset()
      } catch (e) {}
    }
  }, [])

  // Tasteful, single-burst victory confetti (clears previous particles to prevent pile-up)
  const triggerVictoryEffects = useCallback(() => {
    try {
      confetti.reset()
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
        ticks: 180,
        disableForReducedMotion: true,
      })
    } catch (e) {}
  }, [])

  // Strictly single-fire Game Over handler
  const triggerGameOver = useCallback(({ isWin, scoreDiff = 0, result }) => {
    if (isGameOverHandledRef.current) return
    isGameOverHandledRef.current = true

    setGameResult(result)
    if (roomCode) {
      clearRoomState(roomCode)
      markRoomClosed(roomCode)
    }
    clearActive1v1Match()
    onSendAction && onSendAction({ type: 'MATCH_ENDED', roomCode })

    if (isWin) {
      sounds.playWin()
      triggerVictoryEffects()
    } else {
      sounds.playOver()
    }

    if (onGameOver) {
      onGameOver({ isWin, scoreDiff })
    }
  }, [roomCode, onSendAction, onGameOver, triggerVictoryEffects])

  const myPlayerIndex = mode === 'bot' ? 0 : isHost ? 0 : 1
  const isMyTurn = curPlayer === myPlayerIndex

  // 1v1 Online Match Auto-Return to Dashboard Countdown (7s)
  useEffect(() => {
    if (gameResult && mode === 'matchmaking') {
      setReturnCountdown(7)
      const timer = setInterval(() => {
        setReturnCountdown((prev) => {
          if (prev === null) return null
          if (prev <= 1) {
            clearInterval(timer)
            try { confetti.reset() } catch (e) {}
            onExitToLobby && onExitToLobby()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [gameResult, mode, onExitToLobby])

  const hasOpponentConnectedInSession = useRef(!isOpponentDisconnected)
  useEffect(() => {
    if (!isOpponentDisconnected) {
      hasOpponentConnectedInSession.current = true
    }
  }, [isOpponentDisconnected])

  // Disconnect Forfeit Countdown in 1v1 Matchmaking (20s limit)
  useEffect(() => {
    if (mode !== 'matchmaking' || gameResult) return

    let interval = null
    if (isOpponentDisconnected) {
      const isRejoiningEmptyRoom = !hasOpponentConnectedInSession.current
      const initialSeconds = isRejoiningEmptyRoom ? 10 : 20
      setDisconnectCountdown(initialSeconds)

      interval = setInterval(() => {
        setDisconnectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            if (isRejoiningEmptyRoom) {
              // Opponent was never in this session: match has already ended! No free points!
              const result = {
                winner: null,
                title: 'Match Concluded ⏱️',
                type: 'draw',
                subtitle: 'This match has already ended or timed out.',
              }
              setGameResult(result)
              if (roomCode) {
                clearRoomState(roomCode)
                markRoomClosed(roomCode)
              }
              clearActive1v1Match()
              return 0
            }

            // Genuine opponent disconnect during active match
            const result = {
              winner: myPlayerIndex,
              title: '🏆 Opponent Forfeited!',
              type: 'win',
              subtitle: 'Opponent disconnected from the duel.',
            }
            triggerGameOver({ isWin: true, scoreDiff: 1, result })
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setDisconnectCountdown(20)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isOpponentDisconnected, mode, gameResult, myPlayerIndex, roomCode, onGameOver, onSendAction])

  // Turn Inactivity Timer in 1v1 Matchmaking (35s per turn)
  useEffect(() => {
    if (mode !== 'matchmaking' || gameResult || isOpponentDisconnected) return

    setTurnSecondsLeft(35)
    const interval = setInterval(() => {
      setTurnSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          if (isMyTurn) {
            const result = {
              winner: myPlayerIndex === 0 ? 1 : 0,
              title: '⏳ Turn Timed Out',
              type: 'loss',
              subtitle: 'You ran out of time on your turn.',
            }
            triggerGameOver({ isWin: false, scoreDiff: 1, result })
          } else {
            const result = {
              winner: myPlayerIndex,
              title: '🏆 Opponent Timed Out!',
              type: 'win',
              subtitle: 'Opponent was inactive on their turn.',
            }
            triggerGameOver({ isWin: true, scoreDiff: 1, result })
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [curPlayer, isOpponentDisconnected, mode, gameResult, isMyTurn, myPlayerIndex, roomCode, onGameOver])

  const triggerTauntDisplay = useCallback((data) => {
    if (tauntTimerRef.current) clearTimeout(tauntTimerRef.current)
    setTauntData(data)
    tauntTimerRef.current = setTimeout(() => {
      setTauntData(null)
    }, 3200)
  }, [])

  useEffect(() => {
    return () => {
      if (tauntTimerRef.current) clearTimeout(tauntTimerRef.current)
    }
  }, [])

  // Detect when opponent reconnects/rejoins
  useEffect(() => {
    if (mode === 'friend' && prevDisconnectedRef.current && !isOpponentDisconnected) {
      setShowRejoinChoice(true)
      if (onSendAction) {
        onSendAction({ type: 'SHOW_REJOIN_CHOICE' })
      }
    }
    prevDisconnectedRef.current = isOpponentDisconnected
  }, [isOpponentDisconnected, mode, onSendAction])

  // Persist quick board state
  useEffect(() => {
    if ((mode === 'friend' || mode === 'matchmaking') && roomCode && !gameResult) {
      saveRoomState(roomCode, {
        quickBoard: board,
        curPlayer,
      })
    }
  }, [board, curPlayer, mode, roomCode, gameResult])

  const executeMove = useCallback((idx, player) => {
    setBoard((prev) => {
      const next = [...prev]
      next[idx] = player
      return next
    })
    sounds.playDot()

    const nextBoard = [...board]
    nextBoard[idx] = player
    const res = checkQuickWinner(nextBoard)

    if (res) {
      if (res.winner === 'tie') {
        const result = { winner: 'tie', title: '🤝 Tie Game!' }
        triggerGameOver({ isWin: false, scoreDiff: 0, result })
      } else {
        sounds.playCut()
        setWinningLine(res.line)
        const won = res.winner === myPlayerIndex
        const result = {
          winner: res.winner,
          title: won ? '🏆 You Won!' : 'Defeat! Opponent Won',
          type: won ? 'win' : 'loss',
        }
        triggerGameOver({ isWin: won, scoreDiff: 20, result })
      }
      return
    }

    setCurPlayer(player === 0 ? 1 : 0)
  }, [board, myPlayerIndex, triggerGameOver])

  const handleCellClick = (idx) => {
    if (board[idx] !== null || gameResult || !isMyTurn || isOpponentDisconnected) return
    executeMove(idx, myPlayerIndex)

    if (mode !== 'bot' && onSendAction) {
      onSendAction({ type: 'QUICK_MOVE', idx, player: myPlayerIndex })
    }
  }

  // Handle incoming remote action
  useEffect(() => {
    if (!lastRemoteAction) return
    if (lastRemoteAction.type === 'QUICK_MOVE') {
      const { idx, player } = lastRemoteAction
      if (board[idx] === null) {
        executeMove(idx, player)
      }
    } else if (lastRemoteAction.type === 'QUICK_RESTART') {
      resetGame(false)
    } else if (lastRemoteAction.type === 'QUICK_RESET_REQUEST') {
      setPendingResetIncoming({ requestedBy: lastRemoteAction.requestedBy || 'Opponent' })
    } else if (lastRemoteAction.type === 'QUICK_RESET_ACCEPTED') {
      setPendingResetOutgoing(false)
      setPendingResetIncoming(null)
      resetGame(false)
    } else if (lastRemoteAction.type === 'QUICK_RESET_DECLINED') {
      setPendingResetOutgoing(false)
      setResetNotice('Opponent declined reset request.')
      setTimeout(() => setResetNotice(null), 3500)
    } else if (lastRemoteAction.type === 'QUICK_STATE_SYNC') {
      if (lastRemoteAction.state) {
        if (lastRemoteAction.state.quickBoard) setBoard(lastRemoteAction.state.quickBoard)
        if (lastRemoteAction.state.curPlayer !== undefined) setCurPlayer(lastRemoteAction.state.curPlayer)
      }
    } else if (lastRemoteAction.type === 'SHOW_REJOIN_CHOICE') {
      setShowRejoinChoice(true)
    } else if (lastRemoteAction.type === 'REJOIN_CHOICE_RESUME') {
      setShowRejoinChoice(false)
      setReconnectBanner(true)
      setTimeout(() => setReconnectBanner(false), 2500)
      if (isHost && onSendAction) {
        onSendAction({
          type: 'QUICK_STATE_SYNC',
          state: { quickBoard: board, curPlayer },
        })
      }
    } else if (lastRemoteAction.type === 'REJOIN_CHOICE_RESTART') {
      setShowRejoinChoice(false)
      resetGame(false)
    } else if (lastRemoteAction.type === 'TAUNT') {
      const sender = lastRemoteAction.senderName || opponentProfile?.username || 'Opponent'
      triggerTauntDisplay({ text: lastRemoteAction.text, sender, isSelf: false })
    } else if (lastRemoteAction.type === 'FORFEIT') {
      const result = {
        winner: myPlayerIndex,
        title: '🏆 Opponent Forfeited!',
        type: 'win',
        subtitle: `${lastRemoteAction.sender || 'Opponent'} left the match. You win by forfeit!`,
      }
      triggerGameOver({ isWin: true, scoreDiff: 1, result })
    }
  }, [lastRemoteAction, triggerTauntDisplay, opponentProfile, myPlayerIndex, roomCode, onGameOver])

  // Bot Turn
  useEffect(() => {
    if (mode !== 'bot' || curPlayer !== 1 || gameResult) return

    setIsBotThinking(true)
    const timer = setTimeout(() => {
      const move = getQuickAiMove(board, botDifficulty)
      if (move !== null) {
        executeMove(move, 1)
      }
      setIsBotThinking(false)
    }, 550)

    return () => clearTimeout(timer)
  }, [curPlayer, mode, board, gameResult, botDifficulty, executeMove])

  const resetGame = (broadcast = true) => {
    isGameOverHandledRef.current = false
    try { confetti.reset() } catch (e) {}
    setBoard(Array(9).fill(null))
    setCurPlayer(0)
    setWinningLine(null)
    setGameResult(null)
    setIsBotThinking(false)
    setPendingResetOutgoing(false)
    setPendingResetIncoming(null)
    if (roomCode) clearRoomState(roomCode)
    if (broadcast && mode !== 'bot' && onSendAction) {
      onSendAction({ type: 'QUICK_RESTART' })
    }
  }

  const handleSendTaunt = (msg) => {
    triggerTauntDisplay({ text: msg, sender: 'You', isSelf: true })
    if (onSendAction) {
      onSendAction({ type: 'TAUNT', text: msg, senderName: currentUser?.username || 'Player' })
    }
  }

  const handleResetClick = () => {
    if (mode === 'friend' && !gameResult && !isOpponentDisconnected) {
      setPendingResetOutgoing(true)
      if (onSendAction) {
        onSendAction({
          type: 'QUICK_RESET_REQUEST',
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
      onSendAction({ type: 'QUICK_RESET_ACCEPTED' })
    }
  }

  const handleDeclineReset = () => {
    setPendingResetIncoming(null)
    if (onSendAction) {
      onSendAction({ type: 'QUICK_RESET_DECLINED' })
    }
  }

  // Rejoin Choice Handlers
  const handleChooseResume = () => {
    setShowRejoinChoice(false)
    setReconnectBanner(true)
    setTimeout(() => setReconnectBanner(false), 2500)
    if (onSendAction) {
      onSendAction({ type: 'REJOIN_CHOICE_RESUME' })
      if (isHost) {
        onSendAction({
          type: 'QUICK_STATE_SYNC',
          state: { board, curPlayer },
        })
      }
    }
  }

  const handleChooseRestart = () => {
    setShowRejoinChoice(false)
    resetGame(true)
    if (onSendAction) {
      onSendAction({ type: 'REJOIN_CHOICE_RESTART' })
    }
  }

  const p1Name = isHost ? currentUser.username : (opponentProfile?.username || 'Host')
  const p2Name = mode === 'bot' ? 'Bot' : !isHost ? currentUser.username : (opponentProfile?.username || 'Challenger')

  return (
    <div className="quick-vettu-wrapper">
      {/* Opponent Disconnected / Connection Error Waiting Banner */}
      {isOpponentDisconnected && (
        <div className="reconnect-alert-banner connection-waiting-banner minimal-conn-banner">
          <div className="conn-main-row">
            <RefreshCw size={15} className="spin-slow" />
            <span className="conn-status-text">
              {mode === 'matchmaking'
                ? `Opponent disconnected · Forfeit win in ${disconnectCountdown}s`
                : 'Friend Disconnected · Game Paused'}
            </span>
            <button
              type="button"
              className="info-circle-btn sm-info-btn"
              onClick={() => setShowConnInfo(!showConnInfo)}
              title="Connection Details"
              aria-label="Connection Details"
            >
              <Info size={13} />
            </button>
          </div>
          {showConnInfo && (
            <div className="conn-info-popover">
              {mode === 'matchmaking'
                ? 'If your opponent does not reconnect within 20 seconds, you will automatically be awarded a forfeit victory.'
                : 'Waiting for your friend to re-open the room. Once reconnected, you can resume immediately!'}
            </div>
          )}
        </div>
      )}

      {reconnectBanner && (
        <div className="reconnect-success-banner">
          <CheckCircle size={18} />
          <span>Game synchronized and resumed where you left off!</span>
        </div>
      )}

      {/* Scoreboard */}
      <div className="creamy-card board-scoreboard-card">
        <div className={`scoreboard-player p1-box ${curPlayer === 0 && !gameResult ? 'is-active-turn' : 'is-inactive-turn'}`}>
          <div className="player-avatar-badge">
            <img src={getAsset(currentUser.avatar || ASSETS.avatarRed)} alt="P1" className="player-img" />
            <img src={ASSETS.vettuXRed} alt="X" className="piece-indicator-icon" />
            {curPlayer === 0 && !gameResult && <span className="avatar-pulse-ring ring-red" />}
          </div>
          <div className="player-details">
            <div className="player-title-row">
              <span className="player-title-name">{p1Name}</span>
              {curPlayer === 0 && !gameResult && (
                <span className="turn-pulse-badge red-pulse">
                  TURN{mode === 'matchmaking' && !isOpponentDisconnected ? ` ${turnSecondsLeft}s` : ''}
                </span>
              )}
            </div>
            <span className="piece-name">Red X</span>
          </div>
        </div>

        <div className="scoreboard-center">
          <div className="fast-match-badge">⚡ 3x3 Fast Vettu</div>
        </div>

        <div className={`scoreboard-player p2-box ${curPlayer === 1 && !gameResult ? 'is-active-turn' : 'is-inactive-turn'}`}>
          <div className="player-details text-right">
            <div className="player-title-row justify-end">
              {curPlayer === 1 && !gameResult && (
                <span className="turn-pulse-badge blue-pulse">
                  TURN{mode === 'matchmaking' && !isOpponentDisconnected ? ` ${turnSecondsLeft}s` : ''}
                </span>
              )}
              <span className="player-title-name">{p2Name}</span>
            </div>
            <span className="piece-name">Blue X</span>
          </div>
          <div className="player-avatar-badge">
            <img src={mode === 'bot' ? ASSETS.avatarOrange : getAsset(opponentProfile?.avatar || ASSETS.avatarBlue)} alt="P2" className="player-img" />
            <img src={ASSETS.vettuXBlue} alt="O" className="piece-indicator-icon" />
            {curPlayer === 1 && !gameResult && <span className="avatar-pulse-ring ring-blue" />}
          </div>
        </div>
      </div>

      {/* 3x3 Board Arena */}
      <div className="creamy-card quick-board-card">
        {/* Top-Right Vacant Space Icon-Only Restart Game Button */}
        <button
          type="button"
          className="canvas-restart-icon-btn"
          onClick={handleResetClick}
          disabled={pendingResetOutgoing}
          title={pendingResetOutgoing ? 'Waiting for reset approval...' : 'Restart Match'}
          aria-label="Restart Match"
        >
          <RotateCcw size={18} className={pendingResetOutgoing ? 'spin-anim' : ''} />
        </button>

        {/* Floating Active Taunt Toast (Visible to both self and opponent) */}
        {tauntData && (
          <div className={`floating-taunt-banner ${tauntData.isSelf ? 'is-self' : 'is-remote'}`}>
            <span className="floating-taunt-icon">💬</span>
            <span className="floating-taunt-sender">{tauntData.sender}:</span>
            <span className="floating-taunt-text">{tauntData.text}</span>
          </div>
        )}

        <div className="quick-grid">
          {board.map((cell, idx) => {
            const isWinningCell = winningLine && winningLine.includes(idx)
            return (
              <button
                key={idx}
                type="button"
                className={`quick-cell ${cell !== null ? 'has-mark' : 'is-empty'} ${isWinningCell ? 'is-winner-cell' : ''}`}
                onClick={() => handleCellClick(idx)}
                disabled={cell !== null || gameResult || !isMyTurn}
              >
                {cell === null ? (
                  <img src={ASSETS.vettuSlotEmpty} alt="slot" className="quick-slot-empty" />
                ) : (
                  <img
                    src={cell === 0 ? ASSETS.vettuXRed : ASSETS.vettuXBlue}
                    alt={cell === 0 ? 'X Red' : 'X Blue'}
                    className="quick-placed-mark"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Quick Taunt / Reaction Drawer */}
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
            <span>{resetNotice}</span>
          </div>
        )}

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

        {/* Friend Rejoined: Choice to Resume or Start Over Modal */}
        {showRejoinChoice && (
          <div className="board-modal-overlay">
            <div className="creamy-card reset-confirm-modal rejoin-choice-modal">
              <div className="reset-confirm-badge">🎉</div>
              <h3 className="reset-confirm-title">Friend Rejoined!</h3>
              <p className="reset-confirm-desc">
                Your friend is back in the game room! Would you like to resume your ongoing game or start over?
              </p>
              <div className="rejoin-choice-actions">
                <button
                  type="button"
                  className="creamy-btn btn-primary rejoin-btn-resume"
                  onClick={handleChooseResume}
                >
                  <Play size={18} />
                  <span>Resume Current Game</span>
                </button>
                <button
                  type="button"
                  className="creamy-btn rejoin-btn-restart"
                  onClick={handleChooseRestart}
                >
                  <RotateCcw size={18} />
                  <span>Start Over (New Game)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full-Screen Victory / Defeat Modal rendered via React Portal directly into body */}
        {gameResult && typeof document !== 'undefined' && createPortal(
          <div className="board-modal-overlay">
            <div className={`creamy-card result-modal-card is-${gameResult.type || 'tie'}`}>
              <div className="result-icon-badge">
                {gameResult.type === 'win' ? '🏆' : gameResult.type === 'loss' ? '💔' : '🤝'}
              </div>
              <h3 className="result-title">{gameResult.title}</h3>
              <p className="result-sub">
                {gameResult.type === 'win'
                  ? '3-in-a-row victory! Fast strategy paid off.'
                  : gameResult.type === 'loss'
                  ? 'Close match! Ready for a rematch?'
                  : 'Stalemate! Both played a solid match.'}
              </p>

              <div className="result-scores-box">
                <div className="score-team">
                  <img src={ASSETS.vettuXRed} alt="Red" />
                  <span className="team-name">{p1Name}</span>
                </div>
                <div className="score-vs">:</div>
                <div className="score-team">
                  <img src={ASSETS.vettuXBlue} alt="Blue" />
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

              {mode === 'matchmaking' && returnCountdown !== null && (
                <div className="matchmaking-countdown-pill">
                  <span>Returning to Lobby in <strong>{returnCountdown}s</strong>...</span>
                </div>
              )}

              <div className="result-actions-row">
                {mode === 'matchmaking' ? (
                  <button
                    type="button"
                    className="creamy-btn btn-primary rematch-btn"
                    onClick={onExitToLobby}
                  >
                    <span>Return to Lobby Now</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="creamy-btn btn-primary rematch-btn"
                      onClick={resetGame}
                    >
                      <RotateCcw size={17} />
                      <span>Play Again</span>
                    </button>
                    {onExitToLobby && (
                      <button
                        type="button"
                        className="creamy-btn exit-lobby-btn"
                        onClick={onExitToLobby}
                      >
                        <span>Lobby</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}
