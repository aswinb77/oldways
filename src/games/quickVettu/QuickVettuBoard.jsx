import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import confetti from 'canvas-confetti'
import { RotateCcw, Sparkles, MessageSquare, WifiOff, Play, RefreshCw, CheckCircle } from 'lucide-react'
import { checkQuickWinner, getQuickAiMove, QUICK_LINES } from './quickVettuLogic'
import { sounds } from '../../utils/audio'
import { saveRoomState, loadRoomState, clearRoomState } from '../../utils/userStore'

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
}) {
  const savedState = useMemo(() => {
    if (mode === 'friend' && roomCode) {
      const saved = loadRoomState(roomCode)
      if (saved && saved.quickBoard) return saved
    }
    return null
  }, [mode, roomCode])

  const [board, setBoard] = useState(() => savedState?.quickBoard || Array(9).fill(null))
  const [curPlayer, setCurPlayer] = useState(() => savedState?.curPlayer || 0) // 0 = Red X, 1 = Blue X
  const [winningLine, setWinningLine] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [tauntData, setTauntData] = useState(null)
  const tauntTimerRef = useRef(null)
  const [reconnectBanner, setReconnectBanner] = useState(false)
  const [pendingResetOutgoing, setPendingResetOutgoing] = useState(false)
  const [pendingResetIncoming, setPendingResetIncoming] = useState(null)
  const [resetNotice, setResetNotice] = useState(null)
  const [showRejoinChoice, setShowRejoinChoice] = useState(false)
  const prevDisconnectedRef = useRef(isOpponentDisconnected)

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

  const myPlayerIndex = mode === 'bot' ? 0 : isHost ? 0 : 1
  const isMyTurn = curPlayer === myPlayerIndex

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
    if (mode === 'friend' && roomCode && !gameResult) {
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
      if (roomCode) clearRoomState(roomCode)
      if (res.winner === 'tie') {
        sounds.playOver()
        setGameResult({ winner: 'tie', title: '🤝 Tie Game!' })
        onGameOver && onGameOver({ isWin: false, scoreDiff: 0 })
      } else {
        sounds.playCut()
        setWinningLine(res.line)
        const won = res.winner === myPlayerIndex
        if (won) {
          sounds.playWin()
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } })
        } else {
          sounds.playOver()
        }
        setGameResult({
          winner: res.winner,
          title: won ? '🏆 You Won!' : 'Defeat! Opponent Won',
          type: won ? 'win' : 'loss',
        })
        onGameOver && onGameOver({ isWin: won, scoreDiff: 20 })
      }
      return
    }

    setCurPlayer(player === 0 ? 1 : 0)
  }, [board, myPlayerIndex, onGameOver, roomCode])

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
    }
  }, [lastRemoteAction, triggerTauntDisplay, opponentProfile])

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
        <div className="reconnect-alert-banner connection-waiting-banner">
          <div className="conn-spin-wrap">
            <RefreshCw size={22} className="spin-slow" />
          </div>
          <div className="conn-text-wrap">
            <div className="conn-main-title">
              Connection Error: Friend Disconnected
            </div>
            <div className="conn-sub-desc">
              Game is paused. As soon as your friend re-opens the link or reconnects, you will get the choice to resume or start over!
            </div>
          </div>
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
            <img src={currentUser.avatar} alt="P1" className="player-img" />
            <img src="/assets/vettu-x-red.png" alt="X" className="piece-indicator-icon" />
            {curPlayer === 0 && !gameResult && <span className="avatar-pulse-ring ring-red" />}
          </div>
          <div className="player-details">
            <div className="player-title-row">
              <span className="player-title-name">{p1Name}</span>
              {curPlayer === 0 && !gameResult && <span className="turn-pulse-badge red-pulse">TURN</span>}
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
                  TURN
                </span>
              )}
              <span className="player-title-name">{p2Name}</span>
            </div>
            <span className="piece-name">Blue X</span>
          </div>
          <div className="player-avatar-badge">
            <img src={mode === 'bot' ? '/assets/avatar-orange.png' : (opponentProfile?.avatar || '/assets/avatar-blue.png')} alt="P2" className="player-img" />
            <img src="/assets/vettu-x-blue.png" alt="O" className="piece-indicator-icon" />
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
                  <img src="/assets/vettu-slot-empty.png" alt="slot" className="quick-slot-empty" />
                ) : (
                  <img
                    src={cell === 0 ? '/assets/vettu-x-red.png' : '/assets/vettu-x-blue.png'}
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

        {/* Modal on game result */}
        {gameResult && (
          <div className="board-modal-overlay">
            <div className={`creamy-card result-modal-card is-${gameResult.type || 'tie'}`}>
              <div className="result-icon-badge">
                {gameResult.type === 'win' ? '🏆' : gameResult.type === 'loss' ? '💔' : '🤝'}
              </div>
              <h3 className="result-title">{gameResult.title}</h3>
              <button type="button" className="creamy-btn btn-primary rematch-btn" onClick={resetGame}>
                <RotateCcw size={17} />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
