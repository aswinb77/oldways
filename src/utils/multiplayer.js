// Real-time 1v1 Multiplayer Engine with Supabase Realtime Broadcast + WebRTC Fallback + BroadcastChannel
// Enforces strictly ONE host and ONE guest per room code (rejects 3rd+ guests with ROOM_FULL)
import { Peer } from 'peerjs'
import { supabase } from './supabaseClient.js'
import { touchActive1v1Match } from './userStore.js'

export class MultiplayerRoom {
  constructor({ roomCode, isHost, playerProfile, selectedGame, onMessage, onStatusChange }) {
    this.roomCode = (roomCode || '').trim().toUpperCase()
    this.isHost = isHost
    this.playerProfile = playerProfile
    this.selectedGame = selectedGame || 'poojyam'
    this.onMessage = onMessage
    this.onStatusChange = onStatusChange

    // Unique identity for slot locking
    this.myId = (playerProfile && playerProfile.id) || `${isHost ? 'host' : 'guest'}_${Math.random().toString(36).substring(2, 7)}`
    this.hostId = isHost ? this.myId : null
    this.acceptedGuestId = null

    this.peer = null
    this.conn = null
    this.bc = null
    this.supabaseChannel = null
    this.connected = false
    this.remoteProfile = null
    this.isDestroyed = false
    this.handshakeInterval = null
    this.guestRetryTimer = null
    this.seenMsgIds = new Set()

    this.init()
  }

  init() {
    this.cleanId = this.roomCode.replace(/[^A-Za-z0-9_-]/g, '')

    // 1. Setup Supabase Realtime Broadcast (Fast, zero-NAT, global cross-device WebSocket relay)
    if (supabase && this.cleanId) {
      try {
        const channelName = `pv_room_${this.cleanId}`
        this.supabaseChannel = supabase.channel(channelName, {
          config: {
            broadcast: { self: false },
          },
        })

        this.supabaseChannel.on('broadcast', { event: 'GAME_MESSAGE' }, ({ payload }) => {
          if (this.isDestroyed || !payload) return
          this.handleIncomingRaw(payload, 'supabase')
        })

        this.supabaseChannelSubscribed = false
        this.supabaseChannel.subscribe((status) => {
          if (this.isDestroyed) return
          if (status === 'SUBSCRIBED') {
            this.supabaseChannelSubscribed = true
            if (this.peerFallbackTimer) {
              clearTimeout(this.peerFallbackTimer)
              this.peerFallbackTimer = null
            }
            this.broadcastPresence()
            if (!this.connected) {
              this.onStatusChange({
                status: 'ready',
                isHost: this.isHost,
                message: 'Connected to game room',
              })
            }
          }
        })
      } catch (err) {
        console.warn('Supabase realtime room error:', err)
      }
    }

    // 2. Setup BroadcastChannel for instant local cross-tab / cross-window
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(`pv_room_${this.cleanId}`)
        this.bc.onmessage = (event) => {
          this.handleIncomingRaw(event.data, 'broadcast')
        }
      } catch (err) {
        console.warn('BroadcastChannel error:', err)
      }
    }

    // 3. Setup WebRTC via PeerJS ONLY as fallback when Supabase is not configured or fails
    if (!supabase) {
      this.initPeerJsFallback()
    } else {
      this.peerFallbackTimer = setTimeout(() => {
        if (!this.connected && !this.supabaseChannelSubscribed && !this.isDestroyed) {
          this.initPeerJsFallback()
        }
      }, 3500)
    }

    // Auto-recover if tab wakes up from mobile background/sleep
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible' && !this.isDestroyed) {
          if (this.peer && this.peer.disconnected) {
            try { this.peer.reconnect() } catch (e) {}
          }
          if (!this.isHost && !this.connected) {
            this.connectToPeer(`pv-host-${this.cleanId}`)
          }
          this.broadcastPresence()
        }
      }
      document.addEventListener('visibilitychange', this.visibilityHandler)
    }

    this.startPresenceLoop()
  }

  initPeerJsFallback() {
    if (this.peer || this.isDestroyed) return

    const peerId = this.isHost
      ? `pv-host-${this.cleanId}`
      : `pv-guest-${this.cleanId}-${this.myId}`

    try {
      this.peer = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
          ],
        },
      })

      this.peer.on('open', (id) => {
        if (this.isDestroyed) return
        this.onStatusChange({ status: 'ready', peerId: id, isHost: this.isHost })

        // If guest, connect to the host
        if (!this.isHost) {
          const hostPeerId = `pv-host-${this.cleanId}`
          this.connectToPeer(hostPeerId)
          this.startGuestConnectLoop()
        }

        this.broadcastPresence()
      })

      this.peer.on('connection', (connection) => {
        if (this.isDestroyed) return
        this.setupConnection(connection)
      })

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && this.isHost) {
          this.onStatusChange({ status: 'ready_local', message: 'Room active' })
        }
      })
    } catch (err) {
      console.warn('PeerJS init note:', err)
    }
  }

  startGuestConnectLoop() {
    if (this.guestRetryTimer) clearInterval(this.guestRetryTimer)

    this.guestRetryTimer = setInterval(() => {
      if (this.connected || this.isDestroyed || this.isHost) {
        clearInterval(this.guestRetryTimer)
        return
      }

      const hostPeerId = `pv-host-${this.cleanId}`
      if (!this.conn || !this.conn.open) {
        this.connectToPeer(hostPeerId)
      }

      this.broadcastPresence()
    }, 2000)
  }

  retryConnection() {
    if (this.peer && this.peer.disconnected) {
      try { this.peer.reconnect() } catch (e) {}
    }
    if (!this.isHost) {
      this.connectToPeer(`pv-host-${this.cleanId}`)
      this.startGuestConnectLoop()
    }
    this.broadcastPresence()
  }

  startPresenceLoop() {
    if (this.handshakeInterval) clearInterval(this.handshakeInterval)
    this.handshakeInterval = setInterval(() => {
      if (this.isDestroyed) return
      this.broadcastPresence()
    }, 1800)
  }

  broadcastPresence() {
    if (this.isHost) {
      this.sendRaw({
        type: 'HOST_ONLINE',
        hostId: this.myId,
        acceptedGuestId: this.acceptedGuestId,
        isFull: this.acceptedGuestId !== null,
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
        connected: this.connected,
      })
    } else {
      this.sendRaw({
        type: 'GUEST_ONLINE',
        guestId: this.myId,
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
        connected: this.connected,
      })
    }
  }

  connectToPeer(targetId) {
    if (!this.peer || this.peer.destroyed) return
    try {
      const connection = this.peer.connect(targetId, { reliable: true })
      this.setupConnection(connection)
    } catch (e) {
      // Ignore
    }
  }

  setupConnection(connection) {
    this.conn = connection

    this.conn.on('open', () => {
      this.markConnected()
      this.send({
        type: 'HANDSHAKE',
        guestId: this.myId,
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
      })
    })

    this.conn.on('data', (data) => {
      this.handleIncomingRaw(data, 'webrtc')
    })

    this.conn.on('close', () => {
      if (!this.supabaseChannel) {
        this.connected = false
        this.onStatusChange({ status: 'disconnected', message: 'Opponent temporarily disconnected' })
        this.startPresenceLoop()
        if (!this.isHost) {
          this.startGuestConnectLoop()
        }
      }
    })

    this.conn.on('error', () => {})
  }

  markConnected(remoteGame) {
    if (this.guestRetryTimer) {
      clearInterval(this.guestRetryTimer)
      this.guestRetryTimer = null
    }
    if (this.connected) return
    this.connected = true
    if (this.handshakeInterval) {
      clearInterval(this.handshakeInterval)
      this.handshakeInterval = null
    }
    this.onStatusChange({
      status: 'connected',
      remoteProfile: this.remoteProfile,
      selectedGame: remoteGame || this.selectedGame,
      isReconnect: false,
    })
  }

  handleIncomingRaw(data, source) {
    if (!data || typeof data !== 'object') return

    // Deduplicate identical messages arriving via multiple transports
    if (data.msgId) {
      if (this.seenMsgIds.has(data.msgId)) return
      this.seenMsgIds.add(data.msgId)
      if (this.seenMsgIds.size > 200) {
        const oldest = this.seenMsgIds.values().next().value
        this.seenMsgIds.delete(oldest)
      }
    }

    // ── MATCH_ENDED: Room is finished ──
    if (data.type === 'MATCH_ENDED') {
      this.onMessage(data)
      return
    }

    // ── 1. REJECTION: Room is full (3rd+ player trying to join) ──
    if (data.type === 'ROOM_FULL') {
      if (!this.isHost && data.targetGuestId === this.myId) {
        this.onStatusChange({
          status: 'room_full',
          message: data.message || 'This room already has 2 players engaged in a duel.',
        })
        this.destroy()
        return
      }
      return
    }

    // ── 2. HOST RECEIVES GUEST_ONLINE ──
    if (data.type === 'GUEST_ONLINE' && this.isHost) {
      const arrivingGuestId = data.guestId || data.profile?.id

      // If room ALREADY has an accepted guest and it is NOT this guest -> REJECT!
      if (this.acceptedGuestId !== null && this.acceptedGuestId !== arrivingGuestId) {
        this.sendRaw({
          type: 'ROOM_FULL',
          targetGuestId: arrivingGuestId,
          hostId: this.myId,
          message: 'Room is full. Another player has already joined this 1v1 duel.',
        })
        return
      }

      // Lock in this guest as the sole opponent
      this.acceptedGuestId = arrivingGuestId
      if (data.profile) this.remoteProfile = data.profile

      if (!this.connected) {
        this.markConnected(this.selectedGame)
      }

      // Welcome this specific guest
      this.sendRaw({
        type: 'HOST_WELCOME',
        hostId: this.myId,
        acceptedGuestId: arrivingGuestId,
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
      })
      return
    }

    // ── 3. GUEST RECEIVES HOST_ONLINE ──
    if (data.type === 'HOST_ONLINE' && !this.isHost) {
      // If host announces room is already full with another guest -> REJECT
      if (data.isFull && data.acceptedGuestId && data.acceptedGuestId !== this.myId) {
        this.onStatusChange({
          status: 'room_full',
          message: 'This room already has 2 players engaged in a duel.',
        })
        this.destroy()
        return
      }

      this.hostId = data.hostId
      if (data.profile) this.remoteProfile = data.profile
      if (data.selectedGame) this.selectedGame = data.selectedGame

      // Request admission from host
      this.sendRaw({
        type: 'GUEST_ONLINE',
        guestId: this.myId,
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
      })
      return
    }

    // ── 4. GUEST RECEIVES HOST_WELCOME ──
    if (data.type === 'HOST_WELCOME' && !this.isHost) {
      // Verify this welcome was issued to ME
      if (data.acceptedGuestId && data.acceptedGuestId !== this.myId) {
        // Someone else was admitted! Reject me
        this.onStatusChange({
          status: 'room_full',
          message: 'This room already has 2 players (another player joined first).',
        })
        this.destroy()
        return
      }

      this.hostId = data.hostId
      if (data.profile) this.remoteProfile = data.profile
      if (data.selectedGame) this.selectedGame = data.selectedGame
      if (!this.connected) {
        this.markConnected(data.selectedGame)
      }
      return
    }

    // ── 5. HANDSHAKE (WebRTC fallback) ──
    if (data.type === 'HANDSHAKE') {
      if (this.isHost) {
        const arrivingGuestId = data.guestId || data.profile?.id
        if (this.acceptedGuestId !== null && this.acceptedGuestId !== arrivingGuestId) {
          this.sendRaw({
            type: 'ROOM_FULL',
            targetGuestId: arrivingGuestId,
            hostId: this.myId,
          })
          return
        }
        this.acceptedGuestId = arrivingGuestId
      }
      if (data.profile) this.remoteProfile = data.profile
      if (data.selectedGame && !this.isHost) this.selectedGame = data.selectedGame
      if (!this.connected) this.markConnected(data.selectedGame)
      this.send({
        type: 'HANDSHAKE_ACK',
        acceptedGuestId: this.acceptedGuestId,
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
      })
      return
    }

    if (data.type === 'HANDSHAKE_ACK') {
      if (!this.isHost && data.acceptedGuestId && data.acceptedGuestId !== this.myId) {
        this.onStatusChange({
          status: 'room_full',
          message: 'This room already has 2 players.',
        })
        this.destroy()
        return
      }
      if (data.profile) this.remoteProfile = data.profile
      if (data.selectedGame && !this.isHost) this.selectedGame = data.selectedGame
      if (!this.connected) this.markConnected(data.selectedGame)
      return
    }

    if (data.type === 'HEARTBEAT') {
      return
    }

    // ── 6. GAME ACTIONS (MOVE, QUICK_MOVE, STATE_SYNC, RESTART, RESET, TAUNT, etc.) ──
    // Strictly isolate: only the 1 accepted host and 1 accepted guest can exchange moves
    if (this.isHost) {
      // Drop any move not sent by the accepted guest
      if (data.senderId && this.acceptedGuestId && data.senderId !== this.acceptedGuestId) {
        return
      }
      if (data.role === 'host') {
        return // Drop own broadcast echo
      }
    } else {
      // Guest drops any move not sent by the host
      if (data.senderId && this.hostId && data.senderId !== this.hostId) {
        return
      }
      if (data.role === 'guest') {
        return // Drop messages from any other guest
      }
    }

    // Forward verified 1v1 action
    this.onMessage(data)
  }

  send(data) {
    touchActive1v1Match()
    if (!data.msgId) {
      data.msgId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    }
    data.senderId = this.myId
    data.role = this.isHost ? 'host' : 'guest'
    this.seenMsgIds.add(data.msgId)

    if (this.conn && this.conn.open) {
      try {
        this.conn.send(data)
      } catch (e) {}
    }
    this.sendRaw(data)
  }

  sendRaw(data) {
    if (!data.msgId) {
      data.msgId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    }
    data.senderId = this.myId
    data.role = this.isHost ? 'host' : 'guest'
    this.seenMsgIds.add(data.msgId)

    if (this.bc) {
      try {
        this.bc.postMessage(data)
      } catch (e) {}
    }

    if (this.supabaseChannel && !this.isDestroyed) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'GAME_MESSAGE',
          payload: data,
        })
      } catch (e) {}
    }
  }

  destroy() {
    this.isDestroyed = true
    if (this.peerFallbackTimer) {
      clearTimeout(this.peerFallbackTimer)
      this.peerFallbackTimer = null
    }
    if (this.guestRetryTimer) {
      clearInterval(this.guestRetryTimer)
      this.guestRetryTimer = null
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
    if (this.handshakeInterval) {
      clearInterval(this.handshakeInterval)
      this.handshakeInterval = null
    }
    if (this.supabaseChannel && supabase) {
      try {
        supabase.removeChannel(this.supabaseChannel)
      } catch (e) {}
      this.supabaseChannel = null
    }
    if (this.conn) {
      try {
        this.conn.close()
      } catch (e) {}
      this.conn = null
    }
    if (this.peer) {
      try {
        this.peer.destroy()
      } catch (e) {}
      this.peer = null
    }
    if (this.bc) {
      try {
        this.bc.close()
      } catch (e) {}
      this.bc = null
    }
  }
}
