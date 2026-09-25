import React, { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import Lobby from './components/Lobby'
import Leaderboard from './components/Leaderboard'
import AuthModal from './components/AuthModal'
import MultiplayerModal from './components/MultiplayerModal'
import PoojyamVettuBoard from './games/poojyamVettu/PoojyamVettuBoard'
import QuickVettuBoard from './games/quickVettu/QuickVettuBoard'
import { loadUser, recordMatchResult } from './utils/userStore'
import { MultiplayerRoom } from './utils/multiplayer'
import { sounds } from './utils/audio'
import { ArrowLeft, Sparkles } from 'lucide-react'
import './App.css'

export default function App() {
  const [currentView, setCurrentView] = useState('arena') // 'arena' | 'leaderboard' | 'hosting'
  const [selectedGame, setSelectedGame] = useState('poojyam') // 'poojyam' | 'quick'
  const [gameMode, setGameMode] = useState('bot') // 'bot' | 'friend' | 'matchmaking'
  const [botDifficulty, setBotDifficulty] = useState('insane')
  const [inGame, setInGame] = useState(false)

  // Multiplayer state
  const [roomCode, setRoomCode] = useState('')
  const [isHost, setIsHost] = useState(true)
  const [opponentProfile, setOpponentProfile] = useState(null)
  const [lastRemoteAction, setLastRemoteAction] = useState(null)
  const mpRoomRef = useRef(null)

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isMpModalOpen, setIsMpModalOpen] = useState(false)
  const [mpModalType, setMpModalType] = useState('create_room')
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
      handleJoinFriendRoom(roomParam.toUpperCase())
    }
  }, [])

  // Start Bot Game
  const handleStartBotGame = (diff) => {
    destroyMultiplayer()
    setBotDifficulty(diff)
    setGameMode('bot')
    setIsHost(true)
    setInGame(true)
    setCurrentView('arena')
  }

  // Create 1v1 Friend Room
  const handleCreateFriendRoom = () => {
    destroyMultiplayer()
    const code = `PV-${Math.floor(1000 + Math.random() * 9000)}`
    setRoomCode(code)
    setIsHost(true)
    setGameMode('friend')
    setMpModalType('create_room')
    setIsMpModalOpen(true)

    // Initialize multiplayer host
    mpRoomRef.current = new MultiplayerRoom({
      roomCode: code,
      isHost: true,
      playerProfile: user,
      onMessage: (msg) => {
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile }) => {
        if (status === 'connected') {
          sounds.playMatchFound()
          setOpponentProfile(remoteProfile || { username: 'Friend', avatar: '/assets/catlook.png' })
          setIsMpModalOpen(false)
          setInGame(true)
        }
      },
    })
  }

  // Join 1v1 Friend Room by Code
  const handleJoinFriendRoom = (code) => {
    destroyMultiplayer()
    setRoomCode(code)
    setIsHost(false)
    setGameMode('friend')

    mpRoomRef.current = new MultiplayerRoom({
      roomCode: code,
      isHost: false,
      playerProfile: user,
      onMessage: (msg) => {
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile }) => {
        if (status === 'connected') {
          sounds.playMatchFound()
          setOpponentProfile(remoteProfile || { username: 'Host Player', avatar: '/assets/shield-code-blue.png' })
          setIsMpModalOpen(false)
          setInGame(true)
        }
      },
    })

    // If joining from input, open waiting or direct connect
    setInGame(true)
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

    // Listen for queue matches
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
          setOpponentProfile(remoteProfile || { username: 'Live Player', avatar: '/assets/catlook.png' })
          setIsMpModalOpen(false)
          setInGame(true)
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
        {/* VIEW 1: ARENA (LOBBY OR GAME) */}
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
                    <span>Back to Arena Lobby</span>
                  </button>

                  <div className="session-mode-badge">
                    <span className="mode-tag">
                      {gameMode === 'bot'
                        ? `Practice vs ${botDifficulty.toUpperCase()} Bot`
                        : gameMode === 'friend'
                        ? `1v1 Room Code: ${roomCode}`
                        : '1v1 Online Matchmaking'}
                    </span>
                    {!user.isGuest && (
                      <span className="ranked-match-tag">
                        <Sparkles size={13} color="#D97706" />
                        Ranked Match
                      </span>
                    )}
                  </div>
                </div>

                {/* Render Selected Board */}
                {selectedGame === 'poojyam' ? (
                  <PoojyamVettuBoard
                    mode={gameMode}
                    botDifficulty={botDifficulty}
                    currentUser={user}
                    opponentProfile={opponentProfile}
                    isHost={isHost}
                    onSendAction={handleSendAction}
                    lastRemoteAction={lastRemoteAction}
                    onGameOver={handleGameOver}
                  />
                ) : (
                  <QuickVettuBoard
                    mode={gameMode}
                    botDifficulty={botDifficulty}
                    currentUser={user}
                    opponentProfile={opponentProfile}
                    isHost={isHost}
                    onSendAction={handleSendAction}
                    lastRemoteAction={lastRemoteAction}
                    onGameOver={handleGameOver}
                  />
                )}
              </div>
            ) : (
              <Lobby
                selectedGame={selectedGame}
                setSelectedGame={setSelectedGame}
                onStartBotGame={handleStartBotGame}
                onCreateFriendRoom={handleCreateFriendRoom}
                onJoinFriendRoom={handleJoinFriendRoom}
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

      {/* Multiplayer Waiting & Matchmaking Modal */}
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
    </div>
  )
}
