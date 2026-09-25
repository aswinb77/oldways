import React, { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import Lobby from './components/Lobby'
import Leaderboard from './components/Leaderboard'
import AuthModal from './components/AuthModal'
import MultiplayerModal from './components/MultiplayerModal'
import JoinRoomModal from './components/JoinRoomModal'
import PoojyamVettuBoard from './games/poojyamVettu/PoojyamVettuBoard'
import QuickVettuBoard from './games/quickVettu/QuickVettuBoard'
import { loadUser, recordMatchResult, loadRoomState, clearRoomState } from './utils/userStore'
import { MultiplayerRoom } from './utils/multiplayer'
import { sounds } from './utils/audio'
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react'
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
  const mpRoomRef = useRef(null)

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
    if (mpRoomRef.current) {
      mpRoomRef.current.destroy()
      mpRoomRef.current = null
    }
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
      const savedRole = sessionStorage.getItem(`pv_room_role_${targetCode}`)
      
      // If user was host of this room, resume as host
      if (savedRole === 'host') {
        resumeHostRoom(targetCode)
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

  // Helper to initialize Host Room
  const initMultiplayerHost = (code, hostUser) => {
    sessionStorage.setItem(`pv_room_role_${code}`, 'host')
    mpRoomRef.current = new MultiplayerRoom({
      roomCode: code,
      isHost: true,
      playerProfile: hostUser,
      onMessage: (msg) => {
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile, isReconnect }) => {
        if (status === 'connected') {
          sounds.playMatchFound()
          setIsOpponentDisconnected(false)
          setOpponentProfile(remoteProfile || { username: 'Friend', avatar: '/assets/catlook.png' })
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
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile }) => {
        if (status === 'connected') {
          sounds.playMatchFound()
          setIsOpponentDisconnected(false)
          setOpponentProfile(remoteProfile || { username: 'Host Player', avatar: '/assets/shield-code-blue.png' })
          setIsConnectingGuest(false)
          setInGame(true)
        } else if (status === 'disconnected') {
          setIsOpponentDisconnected(true)
        }
      },
    })
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
      initMultiplayerGuest(pendingJoinRoomCode, friendUser)
    }
  }

  // Start 1v1 Quick Matchmaking
  const handleStartMatchmaking = () => {
    destroyMultiplayer()
    const publicMatchCode = `MATCH-${Math.floor(100 + Math.random() * 900)}`
    setRoomCode(publicMatchCode)
    setIsHost(true)
    setGameMode('matchmaking')
    setMpModalType('matchmaking')
    setIsMpModalOpen(true)
    setIsOpponentDisconnected(false)

    mpRoomRef.current = new MultiplayerRoom({
      roomCode: publicMatchCode,
      isHost: true,
      playerProfile: user,
      onMessage: (msg) => {
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile }) => {
        if (status === 'connected') {
          sounds.playMatchFound()
          setIsOpponentDisconnected(false)
          setOpponentProfile(remoteProfile || { username: 'Live Player', avatar: '/assets/catlook.png' })
          setIsMpModalOpen(false)
          setInGame(true)
        } else if (status === 'disconnected') {
          setIsOpponentDisconnected(true)
        }
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
      avatar: '/assets/aswin-duo.png',
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
    if (roomCode) clearRoomState(roomCode)
    const updated = recordMatchResult({
      isWin,
      mode: gameMode,
      scoreDiff,
      currentUser: user,
    })
    setUser(updated)
  }

  // Return to Lobby
  const handleExitToLobby = () => {
    destroyMultiplayer()
    setIsConnectingGuest(false)
    setIsOpponentDisconnected(false)
    setInGame(false)
  }

  return (
    <div className="game-app-root">
      {/* Creamy Top Navigation */}
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

      <main className="app-container">
        {/* VIEW 1: ARENA (LOBBY OR ACTIVE 1V1 BOARD) */}
        {currentView === 'arena' && (
          <>
            {inGame ? (
              <div className="active-game-session">
                <div className="game-session-topbar">
                  <button
                    type="button"
                    className="creamy-btn back-lobby-btn"
                    onClick={handleExitToLobby}
                  >
                    <ArrowLeft size={17} />
                    <span>Lobby</span>
                  </button>

                  <div className="session-mode-badge">
                    <span className="mode-tag">
                      {gameMode === 'bot'
                        ? `Bot (${botDifficulty.toUpperCase()})`
                        : gameMode === 'friend'
                        ? `Room: ${roomCode}`
                        : '1v1 Matchmaking'}
                    </span>
                    {!user.isGuest && (
                      <span className="ranked-match-tag">
                        <Sparkles size={13} color="#D97706" />
                        Ranked
                      </span>
                    )}
                  </div>
                </div>

                {/* Render Selected Board */}
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
                  Establishing direct 1v1 connection with your friend. The game board will open as soon as both players are in the room!
                </p>
                <button
                  type="button"
                  className="creamy-btn cancel-conn-btn"
                  onClick={handleExitToLobby}
                >
                  Cancel
                </button>
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
        onClose={() => {
          setIsMpModalOpen(false)
          destroyMultiplayer()
        }}
        type={mpModalType}
        roomCode={roomCode}
        onStartSimulatedMatch={handleStartSimulatedMatch}
      />

      {/* Friend Join Name & Avatar Modal */}
      <JoinRoomModal
        isOpen={isJoinRoomModalOpen}
        roomCode={pendingJoinRoomCode}
        currentUser={user}
        onJoinConfirmed={handleFriendJoinConfirmed}
      />
    </div>
  )
}
