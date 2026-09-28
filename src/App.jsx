import React, { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import Lobby from './components/Lobby'
import Leaderboard from './components/Leaderboard'
import AuthModal from './components/AuthModal'
import MultiplayerModal from './components/MultiplayerModal'
import JoinRoomModal from './components/JoinRoomModal'
import PoojyamVettuBoard from './games/poojyamVettu/PoojyamVettuBoard'
import QuickVettuBoard from './games/quickVettu/QuickVettuBoard'
import { loadUser, recordMatchResult, loadRoomState, clearRoomState, markRoomClosed, isRoomClosed, saveRoomRole, getRoomRole, saveRoomGame, getRoomGame, saveActive1v1Match, getActive1v1Match, clearActive1v1Match } from './utils/userStore'
import { MultiplayerRoom } from './utils/multiplayer'
import { SupabaseMatchmaker } from './utils/supabaseMatchmaker'
import { sounds } from './utils/audio'
import { ASSETS } from './utils/assets'
import { ArrowLeft, Sparkles, Loader2, DoorClosed, Info, X, Users, AlertTriangle } from 'lucide-react'
import './App.css'

export default function App() {
  const [currentView, setCurrentView] = useState('arena') // 'arena' | 'leaderboard'
  const [selectedGame, setSelectedGame] = useState('poojyam') // 'poojyam' | 'quick'
  const [gameMode, setGameMode] = useState('bot') // 'bot' | 'friend' | 'matchmaking'
  const [botDifficulty, setBotDifficulty] = useState('insane')
  const [inGame, setInGame] = useState(false)
  const [showConnectTips, setShowConnectTips] = useState(false)

  // Multiplayer state
  const [roomCode, setRoomCode] = useState('')
  const [isHost, setIsHost] = useState(true)
  const [opponentProfile, setOpponentProfile] = useState(null)
  const [lastRemoteAction, setLastRemoteAction] = useState(null)
  const [isOpponentDisconnected, setIsOpponentDisconnected] = useState(false)
  const [isOpponentExited, setIsOpponentExited] = useState(false)
  const [isConnectingGuest, setIsConnectingGuest] = useState(false)
  const [guestStatusMsg, setGuestStatusMsg] = useState(null)
  const [queueStatus, setQueueStatus] = useState(null)
  const [roomExpiredNotice, setRoomExpiredNotice] = useState(null)
  const [roomFullNotice, setRoomFullNotice] = useState(null)
  const [showForfeitModal, setShowForfeitModal] = useState(false)
  const mpRoomRef = useRef(null)
  const fcfsMatchmakerRef = useRef(null)
  const inGameRef = useRef(inGame)
  const gameModeRef = useRef(gameMode)
  const isGameOverRef = useRef(false)

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isMpModalOpen, setIsMpModalOpen] = useState(false)
  const [mpModalType, setMpModalType] = useState('create_room')
  const [isJoinRoomModalOpen, setIsJoinRoomModalOpen] = useState(false)
  const [pendingJoinRoomCode, setPendingJoinRoomCode] = useState('')
  const [isMuted, setIsMuted] = useState(sounds.isMuted())

  const [user, setUser] = useState(loadUser)
  const [active1v1Match, setActive1v1Match] = useState(() => getActive1v1Match())

  // Live monitor for active 1v1 match expiration in lobby:
  // Automatically switches button back to "Start 1v1 Match" as soon as match expires or ends
  useEffect(() => {
    if (!active1v1Match) return
    const interval = setInterval(() => {
      const active = getActive1v1Match()
      if (!active) {
        setActive1v1Match(null)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [active1v1Match])

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

  // Keep refs in sync for back button / popstate interception
  useEffect(() => {
    inGameRef.current = inGame
    gameModeRef.current = gameMode
  }, [inGame, gameMode])

  // Intercept browser and mobile hardware back button
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      if (inGameRef.current) {
        window.history.pushState({ inGame: true }, document.title, window.location.href)
        if (gameModeRef.current !== 'bot' && !isGameOverRef.current) {
          setShowForfeitModal(true)
        } else {
          handleExitToLobby()
        }
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Check URL query parameters for invite links on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room')
    const gameParam = params.get('game')
    const modeParam = params.get('mode')

    if (gameParam && (gameParam === 'poojyam' || gameParam === 'quick')) {
      setSelectedGame(gameParam)
    }

    if (roomParam) {
      const targetCode = roomParam.trim().toUpperCase()
      const activeMatch = getActive1v1Match()
      const is1v1Match = modeParam === '1v1' || targetCode.startsWith('MATCH-') || (activeMatch && activeMatch.roomCode === targetCode)

      // If room was closed or marked finished, display notice and remove param from URL
      if (isRoomClosed(targetCode)) {
        clearActive1v1Match()
        setActive1v1Match(null)
        setRoomExpiredNotice({
          code: targetCode,
          message: `Match ${targetCode} has ended. Returning to lobby.`,
        })
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
        return
      }

      const savedGame = getRoomGame(targetCode) || activeMatch?.game || gameParam
      if (savedGame && (savedGame === 'poojyam' || savedGame === 'quick')) {
        setSelectedGame(savedGame)
      }

      if (is1v1Match) {
        // Direct resume for 1v1 matchmaking - NO friend popup modal!
        const savedRole = getRoomRole(targetCode) || (activeMatch?.isHost ? 'host' : 'guest')
        const roleIsHost = savedRole === 'host'
        const opponent = activeMatch?.opponentProfile || { username: 'Challenger', avatar: ASSETS.avatarPurple }

        destroyMultiplayer()
        setRoomCode(targetCode)
        setIsHost(roleIsHost)
        setGameMode('matchmaking')
        setOpponentProfile(opponent)
        setIsMpModalOpen(false)
        setIsConnectingGuest(false)
        setIsOpponentDisconnected(false)
        setIsOpponentExited(false)
        setInGame(true)
        isGameOverRef.current = false

        const activePayload = {
          roomCode: targetCode,
          isHost: roleIsHost,
          game: savedGame || selectedGame,
          opponentProfile: opponent,
        }
        saveActive1v1Match(activePayload)
        setActive1v1Match(activePayload)

        mpRoomRef.current = new MultiplayerRoom({
          roomCode: targetCode,
          isHost: roleIsHost,
          playerProfile: user,
          selectedGame: savedGame || selectedGame,
          onMessage: (msg) => {
            if (msg && msg.type === 'MATCH_ENDED') {
              clearActive1v1Match()
              setActive1v1Match(null)
              if (msg.roomCode) markRoomClosed(msg.roomCode)
            }
            setLastRemoteAction(msg)
          },
          onStatusChange: ({ status, remoteProfile }) => {
            if (status === 'connected') {
              setIsOpponentDisconnected(false)
              if (remoteProfile) setOpponentProfile(remoteProfile)
            } else if (status === 'disconnected') {
              setIsOpponentDisconnected(true)
            }
          },
        })
        return
      }

      const savedRole = getRoomRole(targetCode)
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
    saveRoomRole(code, 'host')
    const savedGame = getRoomGame(code)
    if (savedGame) setSelectedGame(savedGame)

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
    saveRoomRole(code, 'guest')
    const savedGame = getRoomGame(code)
    if (savedGame) setSelectedGame(savedGame)

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
    setIsOpponentExited(false)
    setInGame(false)
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    setRoomExpiredNotice({
      code: closedCode,
      message: 'The host has left the game. The room has been deleted and the link is now closed.',
    })
  }

  // Helper to initialize Host Room
  const initMultiplayerHost = (code, hostUser) => {
    saveRoomRole(code, 'host')
    saveRoomGame(code, selectedGame)
    mpRoomRef.current = new MultiplayerRoom({
      roomCode: code,
      isHost: true,
      playerProfile: hostUser,
      selectedGame,
      onMessage: (msg) => {
        if (msg && (msg.type === 'ROOM_CLOSED' || msg.type === 'MATCH_ENDED')) {
          clearActive1v1Match()
          setActive1v1Match(null)
          handleRemoteRoomClosed(msg)
          return
        }
        if (msg && msg.type === 'PLAYER_LEFT') {
          setIsOpponentDisconnected(true)
          setIsOpponentExited(true)
          return
        }
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile, isReconnect }) => {
        if (status === 'connected') {
          sounds.playMatchFound()
          setIsOpponentDisconnected(false)
          setIsOpponentExited(false)
          setOpponentProfile(remoteProfile || { username: 'Friend', avatar: ASSETS.avatarCyan })
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
    saveRoomRole(code, 'guest')
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
      selectedGame,
      onMessage: (msg) => {
        if (msg && (msg.type === 'ROOM_CLOSED' || msg.type === 'MATCH_ENDED')) {
          clearActive1v1Match()
          setActive1v1Match(null)
          handleRemoteRoomClosed(msg)
          return
        }
        if (msg && msg.type === 'PLAYER_LEFT') {
          setIsOpponentDisconnected(true)
          setIsOpponentExited(true)
          return
        }
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile, selectedGame: remoteGame, message }) => {
        if (status === 'room_full') {
          destroyMultiplayer()
          setRoomCode('')
          setIsConnectingGuest(false)
          setInGame(false)
          if (typeof window !== 'undefined' && window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname)
          }
          setRoomFullNotice({
            code,
            message: message || 'This room already has 2 players engaged in a duel. Only 1v1 duels are supported.',
          })
          return
        }
        if (message) {
          setGuestStatusMsg(message)
        }
        if (remoteGame && (remoteGame === 'poojyam' || remoteGame === 'quick')) {
          setSelectedGame(remoteGame)
          saveRoomGame(code, remoteGame)
        }
        if (status === 'connected') {
          sounds.playMatchFound()
          setIsOpponentDisconnected(false)
          setIsOpponentExited(false)
          setOpponentProfile(remoteProfile || { username: 'Host Player', avatar: ASSETS.avatarBlue })
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
    saveRoomRole(code, 'host')
    saveRoomGame(code, selectedGame)

    // Ensure host browser is on the corresponding room URL with game parameter
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?room=${code}&game=${selectedGame}`
      window.history.replaceState({ room: code, role: 'host', game: selectedGame }, document.title, newUrl)
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
      saveRoomRole(pendingJoinRoomCode, 'guest')
      const targetGame = getRoomGame(pendingJoinRoomCode) || selectedGame
      if (targetGame) setSelectedGame(targetGame)
      if (typeof window !== 'undefined') {
        const newUrl = `${window.location.pathname}?room=${pendingJoinRoomCode}&game=${targetGame}`
        window.history.replaceState({ room: pendingJoinRoomCode, role: 'guest', game: targetGame }, document.title, newUrl)
      }
      initMultiplayerGuest(pendingJoinRoomCode, friendUser)
    }
  }

  // Start 1v1 Quick Matchmaking with Supabase Cloud Realtime Queue (Logged-in only)
  const handleStartMatchmaking = () => {
    if (user.isGuest) {
      setIsAuthOpen(true)
      return
    }

    destroyMultiplayer()
    setGameMode('matchmaking')
    setMpModalType('matchmaking')
    setIsMpModalOpen(true)
    setIsOpponentDisconnected(false)
    setQueueStatus({ state: 'searching', message: 'Entering global matchmaking pool...' })

    fcfsMatchmakerRef.current = new SupabaseMatchmaker({
      user,
      selectedGame,
      onStatusUpdate: (status) => {
        setQueueStatus(status)
      },
      onMatchFound: ({ roomCode: privateRoomCode, isHost: roleIsHost, opponentProfile: oppProfile, selectedGame: matchGame }) => {
        sounds.playMatchFound()
        setRoomCode(privateRoomCode)
        setIsHost(roleIsHost)
        if (matchGame) setSelectedGame(matchGame)
        const opponent = oppProfile || { username: 'Challenger', avatar: ASSETS.avatarPurple }
        setOpponentProfile(opponent)
        setIsMpModalOpen(false)
        setInGame(true)

        // Save active 1v1 match so player can rejoin upon accidental reload or back button
        const activeMatch = {
          roomCode: privateRoomCode,
          isHost: roleIsHost,
          game: matchGame || selectedGame,
          opponentProfile: opponent,
        }
        saveActive1v1Match(activeMatch)
        setActive1v1Match(activeMatch)
        saveRoomRole(privateRoomCode, roleIsHost ? 'host' : 'guest')
        saveRoomGame(privateRoomCode, matchGame || selectedGame)

        if (typeof window !== 'undefined') {
          const newUrl = `${window.location.pathname}?room=${privateRoomCode}&mode=1v1&game=${matchGame || selectedGame}`
          window.history.replaceState({ room: privateRoomCode, role: roleIsHost ? 'host' : 'guest', mode: '1v1' }, document.title, newUrl)
        }

        // Connect both players into their private 1v1 duel room
        mpRoomRef.current = new MultiplayerRoom({
          roomCode: privateRoomCode,
          isHost: roleIsHost,
          playerProfile: user,
          selectedGame: matchGame || selectedGame,
          onMessage: (msg) => {
            if (msg && msg.type === 'MATCH_ENDED') {
              clearActive1v1Match()
              setActive1v1Match(null)
              if (msg.roomCode) markRoomClosed(msg.roomCode)
            }
            setLastRemoteAction(msg)
          },
          onStatusChange: ({ status, remoteProfile, selectedGame: syncGame }) => {
            if (syncGame) setSelectedGame(syncGame)
            if (status === 'connected') {
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
      avatar: ASSETS.avatarCyan,
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

  // Rejoin an active 1v1 match if user accidentally hit browser back or refreshed
  const handleRejoin1v1Match = (matchToRejoin) => {
    // Validate that the match is still active and has not expired or closed
    const validActive = getActive1v1Match()
    if (!validActive || !validActive.roomCode || isRoomClosed(validActive.roomCode)) {
      clearActive1v1Match()
      setActive1v1Match(null)
      setRoomExpiredNotice({
        message: 'This match has already ended or timed out.',
      })
      return
    }

    const target = matchToRejoin || validActive
    if (!target || !target.roomCode) return

    sounds.playClick()
    setGameMode('matchmaking')
    setRoomCode(target.roomCode)
    setIsHost(target.isHost)
    if (target.game) setSelectedGame(target.game)
    setOpponentProfile(target.opponentProfile || { username: 'Challenger', avatar: ASSETS.avatarPurple })
    setIsOpponentDisconnected(false)
    setIsMpModalOpen(false)
    isGameOverRef.current = false
    setInGame(true)

    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?room=${target.roomCode}&mode=1v1&game=${target.game || selectedGame}`
      window.history.replaceState({ room: target.roomCode, role: target.isHost ? 'host' : 'guest', mode: '1v1' }, document.title, newUrl)
    }

    mpRoomRef.current = new MultiplayerRoom({
      roomCode: target.roomCode,
      isHost: target.isHost,
      playerProfile: user,
      selectedGame: target.game || selectedGame,
      onMessage: (msg) => {
        if (msg && msg.type === 'MATCH_ENDED') {
          clearActive1v1Match()
          setActive1v1Match(null)
          if (msg.roomCode) markRoomClosed(msg.roomCode)
        }
        setLastRemoteAction(msg)
      },
      onStatusChange: ({ status, remoteProfile }) => {
        if (status === 'connected') {
          setIsOpponentDisconnected(false)
          if (remoteProfile) setOpponentProfile(remoteProfile)
        } else if (status === 'disconnected') {
          setIsOpponentDisconnected(true)
        }
      },
    })
  }

  // Abandon 1v1 match from Lobby: forfeits match and clears active state
  const handleAbandon1v1Match = () => {
    sounds.playClick()
    if (active1v1Match?.roomCode) {
      if (mpRoomRef.current) {
        mpRoomRef.current.send({
          type: 'FORFEIT',
          roomCode: active1v1Match.roomCode,
          sender: user?.username || 'Opponent',
          loserId: user?.id,
        })
      }
      markRoomClosed(active1v1Match.roomCode)
      clearRoomState(active1v1Match.roomCode)
    }
    const updated = recordMatchResult({
      isWin: false,
      mode: 'matchmaking',
      scoreDiff: -10,
      currentUser: user,
    })
    setUser(updated)
    clearActive1v1Match()
    setActive1v1Match(null)
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  // Send action to remote player
  const handleSendAction = (action) => {
    if (mpRoomRef.current) {
      mpRoomRef.current.send(action)
    }
  }

  // Game Over outcome tracking
  const handleGameOver = ({ isWin, scoreDiff }) => {
    isGameOverRef.current = true
    if (roomCode) {
      clearRoomState(roomCode)
    }
    clearActive1v1Match()
    setActive1v1Match(null)

    const updated = recordMatchResult({
      isWin,
      mode: gameMode,
      scoreDiff,
      currentUser: user,
    })
    setUser(updated)
  }

  // Intercept in-game back click: prompt for forfeit confirmation if match is still in progress
  const handleBackArrowClick = () => {
    sounds.playClick()
    if (inGame && gameMode !== 'bot' && !isGameOverRef.current) {
      setShowForfeitModal(true)
    } else {
      handleExitToLobby()
    }
  }

  // User confirmed forfeit: awards win to opponent and records loss for user
  const handleConfirmForfeit = () => {
    setShowForfeitModal(false)
    if (mpRoomRef.current) {
      mpRoomRef.current.send({
        type: 'FORFEIT',
        roomCode,
        sender: user?.username || 'Opponent',
        loserId: user?.id,
      })
    }
    handleGameOver({ isWin: false, scoreDiff: -10 })
    clearActive1v1Match()
    setActive1v1Match(null)
    destroyMultiplayer()
    setRoomCode('')
    setIsOpponentDisconnected(false)
    setIsOpponentExited(false)
    setInGame(false)
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  // Return to Lobby: CLOSE the room ONLY if Host leaves; if Guest leaves, keep room open for reconnect
  const handleExitToLobby = () => {
    if (roomCode) {
      if (isHost) {
        // Host left: Close the room completely and invalidate link
        if (mpRoomRef.current) {
          mpRoomRef.current.send({ type: 'ROOM_CLOSED', roomCode, sender: user.username })
        }
        markRoomClosed(roomCode)
        clearRoomState(roomCode)
      } else {
        // Guest left: Do NOT close room! Host is still waiting in the room.
        if (mpRoomRef.current) {
          mpRoomRef.current.send({ type: 'PLAYER_LEFT', roomCode, sender: user.username })
        }
      }
    }
    clearActive1v1Match()
    setActive1v1Match(null)
    destroyMultiplayer()
    setRoomCode('')
    setIsMpModalOpen(false)
    setIsJoinRoomModalOpen(false)
    setIsConnectingGuest(false)
    setIsOpponentDisconnected(false)
    setIsOpponentExited(false)
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
              onClick={handleBackArrowClick}
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
                    onExitToLobby={handleExitToLobby}
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
                    onExitToLobby={handleExitToLobby}
                  />
                )}
              </div>
            ) : isConnectingGuest ? (
              /* Waiting state for joining friend until host is ready */
              <div className="creamy-card guest-connecting-card minimal-connecting-card">
                <div className="connecting-badge">
                  <Loader2 size={36} className="spin-anim" color="#2563EB" />
                </div>
                <div className="connecting-header-row">
                  <h2 className="connecting-title">Connecting to Room {roomCode}</h2>
                  <button
                    type="button"
                    className="info-circle-btn"
                    onClick={() => setShowConnectTips(true)}
                    title="Connection Tips"
                    aria-label="Connection Tips"
                  >
                    <Info size={16} />
                  </button>
                </div>
                <p className="connecting-sub">
                  {guestStatusMsg || 'Waiting for opponent to connect...'}
                </p>

                <div className="guest-conn-actions">
                  <button
                    type="button"
                    className="creamy-btn btn-primary retry-conn-btn"
                    onClick={handleRetryGuestConnection}
                  >
                    <span>🔄 Retry</span>
                  </button>
                  <button
                    type="button"
                    className="creamy-btn cancel-conn-btn"
                    onClick={handleExitToLobby}
                  >
                    Cancel
                  </button>
                </div>

                {showConnectTips && (
                  <div className="creamy-modal-overlay" onClick={() => setShowConnectTips(false)}>
                    <div className="creamy-modal-content rules-info-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="rules-modal-header">
                        <h3>Connection Tips</h3>
                        <button type="button" className="modal-close-btn" onClick={() => setShowConnectTips(false)}>
                          <X size={18} />
                        </button>
                      </div>
                      <ul className="rules-bullets">
                        <li>Make sure your friend has the room open on their screen.</li>
                        <li>If opened inside WhatsApp or Instagram, tap <strong>⋮</strong> and choose <strong>"Open in Chrome"</strong>.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Lobby
                selectedGame={selectedGame}
                setSelectedGame={setSelectedGame}
                onStartBotGame={handleStartBotGame}
                onCreateFriendRoom={handleCreateFriendRoom}
                onJoinFriendRoom={handleJoinFriendRoomFromInput}
                onStartMatchmaking={handleStartMatchmaking}
                active1v1Match={active1v1Match}
                onRejoin1v1Match={handleRejoin1v1Match}
                onAbandon1v1Match={handleAbandon1v1Match}
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
        selectedGame={selectedGame}
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

      {/* Room Full Notice Modal */}
      {roomFullNotice && (
        <div className="creamy-modal-overlay">
          <div className="creamy-modal-content room-expired-modal-box">
            <div className="room-expired-badge" style={{ background: '#FEE2E2', borderColor: '#FECACA' }}>
              <Users size={34} color="#DC2626" />
            </div>
            <h2 className="room-expired-title">Room Full 👥</h2>
            <p className="room-expired-sub">
              {roomFullNotice.message || 'This room already has 2 players engaged in a duel. Only 1v1 duels are supported.'}
            </p>
            <div className="room-full-actions">
              <button
                type="button"
                className="creamy-btn btn-primary"
                onClick={() => {
                  setRoomFullNotice(null)
                  handleCreateFriendRoom()
                }}
              >
                Create Your Own Room
              </button>
              <button
                type="button"
                className="creamy-btn cancel-conn-btn"
                onClick={() => {
                  setRoomFullNotice(null)
                  if (typeof window !== 'undefined') {
                    window.history.replaceState({}, document.title, window.location.pathname)
                  }
                  setCurrentView('arena')
                }}
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forfeit Confirmation Modal */}
      {showForfeitModal && (
        <div className="creamy-modal-overlay">
          <div className="creamy-modal-content room-expired-modal-box forfeit-modal-box">
            <div className="room-expired-badge" style={{ background: '#FEE2E2', borderColor: '#FECACA' }}>
              <AlertTriangle size={34} color="#DC2626" />
            </div>
            <h2 className="room-expired-title">Forfeit Match? ⚠️</h2>
            <p className="room-expired-sub">
              Are you sure you want to leave? Backing out means you <strong>forfeit</strong> this match.
              Your opponent will win and be awarded the victory points.
            </p>
            <div className="forfeit-actions-row">
              <button
                type="button"
                className="creamy-btn btn-primary stay-btn"
                onClick={() => setShowForfeitModal(false)}
              >
                Stay in Game
              </button>
              <button
                type="button"
                className="creamy-btn cancel-conn-btn forfeit-confirm-btn"
                onClick={handleConfirmForfeit}
              >
                Forfeit & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
