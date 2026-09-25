import React, { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import Lobby from './components/Lobby'
import Leaderboard from './components/Leaderboard'
import AuthModal from './components/AuthModal'
import MultiplayerModal from './components/MultiplayerModal'
import JoinRoomModal from './components/JoinRoomModal'
import PoojyamVettuBoard from './games/poojyamVettu/PoojyamVettuBoard'
import QuickVettuBoard from './games/quickVettu/QuickVettuBoard'
import { loadUser, recordMatchResult, loadRoomState, clearRoomState, markRoomClosed, isRoomClosed } from './utils/userStore'
import { MultiplayerRoom } from './utils/multiplayer'
import { FCFSMatchmaker } from './utils/fcfsMatchmaker'
import { sounds } from './utils/audio'
import { ArrowLeft, Sparkles, Loader2, DoorClosed } from 'lucide-react'
import './App.css'

export default function App() {
  const [currentView, setCurrentView] = useState('arena') // 'arena' | 'leaderboard'
  const [selectedGame, setSelectedGame] = useState('poojyam') // 'poojyam' | 'quick'
  const [gameMode, setGameMode] = useState('bot') // 'bot' | 'friend' | 'matchmaking'
  const [botDifficulty, setBotDifficulty] = useState('insane')
  const [inGame, setInGame] = useState(false)

  // Multiplayer state
  const [roomCode, setRoomCode] = useState('')
  const [isHost, setIsHost] = useState(true)
  const [opponentProfile, setOpponentProfile] = useState(null)
  const [lastRemoteAction, setLastRemoteAction] = useState(null)
  const [isOpponentDisconnected, setIsOpponentDisconnected] = useState(false)
  const [isConnectingGuest, setIsConnectingGuest] = useState(false)
  const [guestStatusMsg, setGuestStatusMsg] = useState(null)
  const [queueStatus, setQueueStatus] = useState(null)
  const [roomExpiredNotice, setRoomExpiredNotice] = useState(null)
  const mpRoomRef = useRef(null)
  const fcfsMatchmakerRef = useRef(null)

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isMpModalOpen, setIsMpModalOpen] = useState(false)
  const [mpModalType, setMpModalType] = useState('create_room')
  const [isJoinRoomModalOpen, setIsJoinRoomModalOpen] = useState(false)
  const [pendingJoinRoomCode, setPendingJoinRoomCode] = useState('')
  const [isMuted, setIsMuted] = useState(sounds.isMuted())

  // User state
  const [user, setUser] = useState(loadUser)

  // Clean up multiplayer room when leaving game
  const destroyMultiplayer = () => {
    if (fcfsMatchmakerRef.current) {
      fcfsMatchmakerRef.current.destroy()
      fcfsMatchmakerRef.current = null
    }
    if (mpRoomRef.current) {
      mpRoomRef.current.destroy()
      mpRoomRef.current = null
    }
    setQueueStatus(null)
  }

  // Check URL query parameters for invite links on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room')
    const gameParam = params.get('game')

    if (gameParam && (gameParam === 'poojyam' || gameParam === 'quick')) {
      setSelectedGame(gameParam)
    }

    if (roomParam) {
      const targetCode = roomParam.trim().toUpperCase()
      // If room was closed or marked finished, display notice and remove param from URL
      if (isRoomClosed(targetCode)) {
        setRoomExpiredNotice({
          code: targetCode,
          message: `Room ${targetCode} has ended or both players have left. This link is no longer valid.`,
        })
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
        return
      }

      const savedRole = sessionStorage.getItem(`pv_room_role_${targetCode}`)
      
      // If user was host of this room, resume as host
      if (savedRole === 'host') {
        resumeHostRoom(targetCode)
      } else if (savedRole === 'guest') {
        resumeGuestRoom(targetCode)
      } else {
        // Friend opening the link: ask for name & avatar
        setPendingJoinRoomCode(targetCode)
        setIsJoinRoomModalOpen(true)
      }
    }
  }, [])

  // Resume Host Room upon reload
  const resumeHostRoom = (code) => {
    destroyMultiplayer()
    setRoomCode(code)
    setIsHost(true)
    setGameMode('friend')

    const savedState = loadRoomState(code)
    // If game was already in progress with moves, prepare to show paused board
    if (savedState) {
      setInGame(true)
      setIsOpponentDisconnected(true)
    } else {
      setIsMpModalOpen(true)
      setMpModalType('create_room')
    }

    initMultiplayerHost(code, user)
  }

  // Resume Guest Room upon reload
  const resumeGuestRoom = (code) => {
    destroyMultiplayer()
    setRoomCode(code)
    setIsHost(false)
    setGameMode('friend')

    const savedState = loadRoomState(code)
    if (savedState) {
      setInGame(true)
      setIsOpponentDisconnected(true)
    } else {
      setIsConnectingGuest(true)
    }

    initMultiplayerGuest(code, user)
  }

  // Handle remote notification when opponent leaves and closes room
  const handleRemoteRoomClosed = (msg) => {
    const closedCode = msg?.roomCode || roomCode
    if (closedCode) {
      markRoomClosed(closedCode)
      clearRoomState(closedCode)
    }
    destroyMultiplayer()
    setRoomCode('')
    setIsConnectingGuest(false)
    setIsOpponentDisconnected(false)
    setInGame(false)
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    setRoomExpiredNotice({
      code: closedCode,
      message: 'Your friend has left the game. The room has been deleted and the link is now closed.',
    })
  }

  // Helper to initialize Host Room
  const initMultiplayerHost = (code, hostUser) => {
    sessionStorage.setItem(`pv_room_role_${code}`, 'host')
    mpRoomRef.current = new MultiplayerRoom({
      roomCode: code,
      isHost: true,
      playerProfile: hostUser,
      onMessage: (msg) => {
        if (msg && msg.type === 'ROOM_CLOSED') {
          handleRemoteRoomClosed(msg)
          return
        }
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile, isReconnect }) => {
        if (status === 'connected') {
          sounds.playMatchFound()
          setIsOpponentDisconnected(false)
          setOpponentProfile(remoteProfile || { username: 'Friend', avatar: '/assets/avatar-cyan.png' })
          setIsMpModalOpen(false)
          setIsConnectingGuest(false)
          setInGame(true)
        } else if (status === 'disconnected') {
          setIsOpponentDisconnected(true)
        }
      },
    })
  }

  // Helper to initialize Guest Room connection
  const initMultiplayerGuest = (code, guestUser) => {
    sessionStorage.setItem(`pv_room_role_${code}`, 'guest')
    setRoomCode(code)
    setIsHost(false)
    setGameMode('friend')
    setIsConnectingGuest(true)

    const savedState = loadRoomState(code)
    if (savedState) {
      // Reconnecting to existing paused match
      setInGame(true)
      setIsOpponentDisconnected(true)
    }

    mpRoomRef.current = new MultiplayerRoom({
      roomCode: code,
      isHost: false,
      playerProfile: guestUser,
      onMessage: (msg) => {
        if (msg && msg.type === 'ROOM_CLOSED') {
          handleRemoteRoomClosed(msg)
          return
        }
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile, message }) => {
        if (message) {
          setGuestStatusMsg(message)
        }
        if (status === 'connected') {
          sounds.playMatchFound()
          setIsOpponentDisconnected(false)
          setOpponentProfile(remoteProfile || { username: 'Host Player', avatar: '/assets/avatar-blue.png' })
          setIsConnectingGuest(false)
          setGuestStatusMsg(null)
          setInGame(true)
        } else if (status === 'disconnected') {
          setIsOpponentDisconnected(true)
        }
      },
    })
  }

  // Manual retry for guest connection
  const handleRetryGuestConnection = () => {
    if (mpRoomRef.current) {
      setGuestStatusMsg('Re-attempting connection to friend...')
      mpRoomRef.current.retryConnection()
    }
  }

  // Start Bot Game
  const handleStartBotGame = (diff) => {
    destroyMultiplayer()
    setBotDifficulty(diff)
    setGameMode('bot')
    setIsHost(true)
    setIsOpponentDisconnected(false)
    setInGame(true)
    setCurrentView('arena')
  }

  // Create 1v1 Friend Room (Host)
  const handleCreateFriendRoom = () => {
    destroyMultiplayer()
    const code = `PV-${Math.floor(1000 + Math.random() * 9000)}`
    setRoomCode(code)
    setIsHost(true)
    setGameMode('friend')
    setMpModalType('create_room')
    setIsMpModalOpen(true)
    setIsOpponentDisconnected(false)

    // Ensure host browser is on the corresponding room URL and role is remembered
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`pv_room_role_${code}`, 'host')
      const newUrl = `${window.location.pathname}?room=${code}`
      window.history.replaceState({ room: code, role: 'host' }, document.title, newUrl)
    }

    initMultiplayerHost(code, user)
  }

  // Triggered when friend enters room code from lobby input
  const handleJoinFriendRoomFromInput = (code) => {
    setPendingJoinRoomCode(code)
    setIsJoinRoomModalOpen(true)
  }

  // Friend confirms their Name & Avatar
  const handleFriendJoinConfirmed = (friendUser) => {
    setUser(friendUser)
    setIsJoinRoomModalOpen(false)
    if (pendingJoinRoomCode) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`pv_room_role_${pendingJoinRoomCode}`, 'guest')
        const newUrl = `${window.location.pathname}?room=${pendingJoinRoomCode}`
        window.history.replaceState({ room: pendingJoinRoomCode, role: 'guest' }, document.title, newUrl)
      }
      initMultiplayerGuest(pendingJoinRoomCode, friendUser)
    }
  }

  // Start 1v1 Quick Matchmaking with First-Come-First-Served (FCFS) Queue
  const handleStartMatchmaking = () => {
    destroyMultiplayer()
    setGameMode('matchmaking')
    setMpModalType('matchmaking')
    setIsMpModalOpen(true)
    setIsOpponentDisconnected(false)
    setQueueStatus({ state: 'searching', message: 'Entering global matchmaking queue...' })

    fcfsMatchmakerRef.current = new FCFSMatchmaker({
      user,
      onStatusUpdate: (status) => {
        setQueueStatus(status)
      },
      onMatchFound: ({ roomCode: privateRoomCode, isHost: roleIsHost, opponentProfile: oppProfile }) => {
        sounds.playMatchFound()
        setRoomCode(privateRoomCode)
        setIsHost(roleIsHost)
        setOpponentProfile(oppProfile || { username: 'Challenger', avatar: '/assets/avatar-purple.png' })
        setIsMpModalOpen(false)
        setInGame(true)

        // Connect both players into their private 1v1 duel room
        mpRoomRef.current = new MultiplayerRoom({
          roomCode: privateRoomCode,
          isHost: roleIsHost,
          playerProfile: user,
          onMessage: (msg) => {
            setLastRemoteAction(msg)
          },
          onStatusChange: ({ status, remoteProfile }) => {
            if (status === 'connected') {
              sounds.playMatchFound()
              setIsOpponentDisconnected(false)
              if (remoteProfile) setOpponentProfile(remoteProfile)
            } else if (status === 'disconnected') {
              setIsOpponentDisconnected(true)
            }
          },
        })
      },
    })
  }

  // Fallback: Duel Simulated Ranked Challenger
  const handleStartSimulatedMatch = () => {
    destroyMultiplayer()
    setIsMpModalOpen(false)
    setOpponentProfile({
      id: 'challenger_sneha',
      username: 'Sneha_Thrissur',
      avatar: '/assets/avatar-cyan.png',
      badge: 'Diamond',
      points: 810,
    })
    setBotDifficulty('tactical')
    setGameMode('matchmaking')
    setIsHost(true)
    setIsOpponentDisconnected(false)
    setInGame(true)
    sounds.playMatchFound()
  }

  // Send action to remote player
  const handleSendAction = (action) => {
    if (mpRoomRef.current) {
      mpRoomRef.current.send(action)
    }
  }

  // Game Over outcome tracking
  const handleGameOver = ({ isWin, scoreDiff }) => {
    if (roomCode) {
      clearRoomState(roomCode)
      markRoomClosed(roomCode)
    }
    const updated = recordMatchResult({
      isWin,
      mode: gameMode,
      scoreDiff,
      currentUser: user,
    })
    setUser(updated)
  }

  // Return to Lobby (Closes Room and Invalidates Link)
  const handleExitToLobby = () => {
    if (roomCode) {
      if (mpRoomRef.current) {
        mpRoomRef.current.send({ type: 'ROOM_CLOSED', roomCode, sender: user.username })
      }
      markRoomClosed(roomCode)
      clearRoomState(roomCode)
    }
    destroyMultiplayer()
    setRoomCode('')
    setIsConnectingGuest(false)
    setIsOpponentDisconnected(false)
    setInGame(false)
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  return (
    <div className="game-app-root">
      {/* Top Navigation: Standard Navbar in Lobby; Single '<-' Arrow Icon Only When In Game */}
      {inGame ? (
        <header className="creamy-navbar-wrap in-game-minimal-nav">
          <div className="creamy-navbar in-game-nav-inner">
            <button
              type="button"
              className="creamy-btn in-game-back-arrow"
              onClick={handleExitToLobby}
              aria-label="Back to Lobby"
              title="Back to Lobby"
            >
              <ArrowLeft size={22} />
            </button>
          </div>
        </header>
      ) : (
        <Navbar
          currentView={currentView}
          setCurrentView={(view) => {
            setCurrentView(view)
            if (view !== 'arena') setInGame(false)
          }}
          user={user}
          onOpenAuth={() => setIsAuthOpen(true)}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
        />
      )}

      <main className="app-container">
        {/* VIEW 1: ARENA (LOBBY OR ACTIVE 1V1 BOARD) */}
        {currentView === 'arena' && (
          <>
            {inGame ? (
              <div className="active-game-session">
                {/* Render Selected Board Directly */}
                {selectedGame === 'poojyam' ? (
                  <PoojyamVettuBoard
                    mode={gameMode}
                    roomCode={roomCode}
                    botDifficulty={botDifficulty}
                    currentUser={user}
                    opponentProfile={opponentProfile}
                    isHost={isHost}
                    isOpponentDisconnected={isOpponentDisconnected}
                    onSendAction={handleSendAction}
                    lastRemoteAction={lastRemoteAction}
                    onGameOver={handleGameOver}
                  />
                ) : (
                  <QuickVettuBoard
                    mode={gameMode}
                    roomCode={roomCode}
                    botDifficulty={botDifficulty}
                    currentUser={user}
                    opponentProfile={opponentProfile}
                    isHost={isHost}
                    isOpponentDisconnected={isOpponentDisconnected}
                    onSendAction={handleSendAction}
                    lastRemoteAction={lastRemoteAction}
                    onGameOver={handleGameOver}
                  />
                )}
              </div>
            ) : isConnectingGuest ? (
              /* Waiting state for joining friend until host is ready */
              <div className="creamy-card guest-connecting-card">
                <div className="connecting-badge">
                  <Loader2 size={36} className="spin-anim" color="#2563EB" />
                </div>
                <h2 className="connecting-title">Connecting to Room {roomCode}...</h2>
                <p className="connecting-sub">
                  {guestStatusMsg || 'Establishing direct 1v1 connection with your friend. The game board will open as soon as both players are in the room!'}
                </p>

                <div className="connection-tips-box">
                  <span className="tip-header">💡 Helpful tips if waiting:</span>
                  <ul className="tip-list">
                    <li>Make sure your friend has the room open on their screen (not minimized/asleep).</li>
                    <li>If opened inside WhatsApp/Instagram, tap <strong>⋮</strong> in top-right and choose <strong>"Open in Chrome"</strong>.</li>
                  </ul>
                </div>

                <div className="guest-conn-actions">
                  <button
                    type="button"
                    className="creamy-btn btn-primary retry-conn-btn"
                    onClick={handleRetryGuestConnection}
                  >
                    <span>🔄 Retry Connection</span>
                  </button>
                  <button
                    type="button"
                    className="creamy-btn cancel-conn-btn"
                    onClick={handleExitToLobby}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <Lobby
                selectedGame={selectedGame}
                setSelectedGame={setSelectedGame}
                onStartBotGame={handleStartBotGame}
                onCreateFriendRoom={handleCreateFriendRoom}
                onJoinFriendRoom={handleJoinFriendRoomFromInput}
                onStartMatchmaking={handleStartMatchmaking}
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
              />
            )}
          </>
        )}

        {/* VIEW 2: WEEKLY LEADERBOARD */}
        {currentView === 'leaderboard' && (
          <Leaderboard
            user={user}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}
      </main>

      {/* User Login & Profile Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onUserUpdated={setUser}
      />

      {/* Multiplayer Waiting & Matchmaking Modal (Host) */}
      <MultiplayerModal
        isOpen={isMpModalOpen}
        onClose={handleExitToLobby}
        type={mpModalType}
        roomCode={roomCode}
        queueStatus={queueStatus}
        onStartSimulatedMatch={handleStartSimulatedMatch}
      />

      {/* Friend Join Name & Avatar Modal */}
      <JoinRoomModal
        isOpen={isJoinRoomModalOpen}
        roomCode={pendingJoinRoomCode}
        currentUser={user}
        onJoinConfirmed={handleFriendJoinConfirmed}
      />

      {/* Room Expired / Closed Notice Modal */}
      {roomExpiredNotice && (
        <div className="creamy-modal-overlay">
          <div className="creamy-modal-content room-expired-modal-box">
            <div className="room-expired-badge">
              <DoorClosed size={36} color="#DC2626" />
            </div>
            <h2 className="room-expired-title">Room Closed 🚪</h2>
            <p className="room-expired-sub">
              {roomExpiredNotice.message}
            </p>
            <button
              type="button"
              className="creamy-btn btn-primary"
              onClick={() => {
                setRoomExpiredNotice(null)
                if (typeof window !== 'undefined') {
                  window.history.replaceState({}, document.title, window.location.pathname)
                }
              }}
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
