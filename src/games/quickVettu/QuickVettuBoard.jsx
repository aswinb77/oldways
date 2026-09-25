import React, { useState, useEffect, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { RotateCcw, Sparkles, MessageSquare, WifiOff } from 'lucide-react'
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
  const [tauntMsg, setTauntMsg] = useState(null)

  const myPlayerIndex = mode === 'bot' ? 0 : isHost ? 0 : 1
  const isMyTurn = curPlayer === myPlayerIndex

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
      resetGame()
    } else if (lastRemoteAction.type === 'QUICK_STATE_SYNC') {
      if (lastRemoteAction.state) {
        if (lastRemoteAction.state.quickBoard) setBoard(lastRemoteAction.state.quickBoard)
        if (lastRemoteAction.state.curPlayer !== undefined) setCurPlayer(lastRemoteAction.state.curPlayer)
      }
    } else if (lastRemoteAction.type === 'TAUNT') {
      setTauntMsg(lastRemoteAction.text)
      setTimeout(() => setTauntMsg(null), 3000)
    }
  }, [lastRemoteAction])

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

  const resetGame = () => {
    setBoard(Array(9).fill(null))
    setCurPlayer(0)
    setWinningLine(null)
    setGameResult(null)
    setIsBotThinking(false)
    if (roomCode) clearRoomState(roomCode)
    if (mode !== 'bot' && onSendAction) {
      onSendAction({ type: 'QUICK_RESTART' })
    }
  }

  const p1Name = isHost ? currentUser.username : (opponentProfile?.username || 'Host')
  const p2Name = mode === 'bot' ? 'Bot' : !isHost ? currentUser.username : (opponentProfile?.username || 'Challenger')

  return (
    <div className="quick-vettu-wrapper">
      {isOpponentDisconnected && (
        <div className="reconnect-alert-banner">
          <WifiOff size={18} className="spin-slow" />
          <span>Opponent disconnected. Waiting for them to reconnect to resume match...</span>
        </div>
      )}

      {/* Scoreboard */}
      <div className="creamy-card board-scoreboard-card">
        <div className={`scoreboard-player p1-box ${curPlayer === 0 && !gameResult ? 'is-active-turn' : ''}`}>
          <div className="player-avatar-badge">
            <img src={currentUser.avatar} alt="P1" className="player-img" />
            <img src="/assets/vettu-x-red.png" alt="X" className="piece-indicator-icon" />
          </div>
          <div className="player-details">
            <span className="player-title-name">{p1Name}</span>
            <span className="piece-name">Red X</span>
          </div>
          {curPlayer === 0 && !gameResult && <span className="turn-pulse-badge red-pulse">TURN</span>}
        </div>

        <div className="scoreboard-center">
          <div className="fast-match-badge">⚡ 3x3 Fast Vettu</div>
          {tauntMsg && <div className="live-taunt-bubble">{tauntMsg}</div>}
        </div>

        <div className={`scoreboard-player p2-box ${curPlayer === 1 && !gameResult ? 'is-active-turn' : ''}`}>
          {curPlayer === 1 && !gameResult && <span className="turn-pulse-badge blue-pulse">TURN</span>}
          <div className="player-details text-right">
            <span className="player-title-name">{p2Name}</span>
            <span className="piece-name">Blue X</span>
          </div>
          <div className="player-avatar-badge">
            <img src={mode === 'bot' ? '/assets/catlook.png' : (opponentProfile?.avatar || '/assets/shield-code-blue.png')} alt="P2" className="player-img" />
            <img src="/assets/vettu-x-blue.png" alt="O" className="piece-indicator-icon" />
          </div>
        </div>
      </div>

      {/* 3x3 Board Arena */}
      <div className="creamy-card quick-board-card">
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

        <div className="board-controls-bar">
          <button type="button" className="creamy-btn" onClick={resetGame}>
            <RotateCcw size={16} />
            <span>Restart Match</span>
          </button>
        </div>

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
