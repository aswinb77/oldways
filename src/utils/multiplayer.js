// Real-time 1v1 Multiplayer Engine with Supabase Realtime Broadcast + WebRTC Fallback + BroadcastChannel
import { Peer } from 'peerjs'
import { supabase } from './supabaseClient'

export class MultiplayerRoom {
  constructor({ roomCode, isHost, playerProfile, selectedGame, onMessage, onStatusChange }) {
    this.roomCode = (roomCode || '').trim().toUpperCase()
    this.isHost = isHost
    this.playerProfile = playerProfile
    this.selectedGame = selectedGame || 'poojyam'
    this.onMessage = onMessage
    this.onStatusChange = onStatusChange

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

        this.supabaseChannel.subscribe((status) => {
          if (this.isDestroyed) return
          if (status === 'SUBSCRIBED') {
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

    // 3. Setup WebRTC via PeerJS as secondary peer-to-peer channel
    const peerId = this.isHost
      ? `pv-host-${this.cleanId}`
      : `pv-guest-${this.cleanId}-${Math.random().toString(36).substring(2, 7)}`

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
        // Silently tolerate WebRTC issues since Supabase Realtime handles online multiplayer
        if (err.type === 'unavailable-id' && this.isHost) {
          this.onStatusChange({ status: 'ready_local', message: 'Room active' })
        }
      })
    } catch (err) {
      console.warn('PeerJS init note:', err)
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

  startGuestConnectLoop() {
    if (this.guestRetryTimer) clearInterval(this.guestRetryTimer)
    let retries = 0

    this.guestRetryTimer = setInterval(() => {
      if (this.connected || this.isDestroyed || this.isHost) {
        clearInterval(this.guestRetryTimer)
        return
      }

      retries++
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
    this.sendRaw({
      type: this.isHost ? 'HOST_ONLINE' : 'GUEST_ONLINE',
      profile: this.playerProfile,
      selectedGame: this.selectedGame,
      connected: this.connected,
    })
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
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
      })
    })

    this.conn.on('data', (data) => {
      this.handleIncomingRaw(data, 'webrtc')
    })

    this.conn.on('close', () => {
      // Do not drop connection immediately if Supabase channel is still active
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
    const wasConnected = this.connected
    this.connected = true
    this.onStatusChange({
      status: 'connected',
      remoteProfile: this.remoteProfile,
      selectedGame: remoteGame || this.selectedGame,
      isReconnect: wasConnected,
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

    // Handshake & Presence handling
    if (data.type === 'HOST_ONLINE' && !this.isHost) {
      if (data.profile) this.remoteProfile = data.profile
      if (data.selectedGame) this.selectedGame = data.selectedGame
      if (!this.connected) {
        this.markConnected(data.selectedGame)
      }
      this.sendRaw({
        type: 'GUEST_ONLINE',
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
      })
    } else if (data.type === 'GUEST_ONLINE' && this.isHost) {
      if (data.profile) this.remoteProfile = data.profile
      if (!this.connected) {
        this.markConnected(this.selectedGame)
      }
      this.sendRaw({
        type: 'HOST_WELCOME',
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
      })
    } else if (data.type === 'HOST_WELCOME') {
      if (data.profile) this.remoteProfile = data.profile
      if (data.selectedGame) this.selectedGame = data.selectedGame
      this.markConnected(data.selectedGame)
    } else if (data.type === 'HANDSHAKE') {
      if (data.profile) this.remoteProfile = data.profile
      if (data.selectedGame && !this.isHost) this.selectedGame = data.selectedGame
      this.markConnected(data.selectedGame)
      this.send({
        type: 'HANDSHAKE_ACK',
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
      })
    } else if (data.type === 'HANDSHAKE_ACK') {
      if (data.profile) this.remoteProfile = data.profile
      if (data.selectedGame && !this.isHost) this.selectedGame = data.selectedGame
      this.markConnected(data.selectedGame)
    } else if (data.type === 'HEARTBEAT') {
      if (!this.connected) this.markConnected()
    } else {
      // Forward game actions (MOVE, QUICK_MOVE, STATE_SYNC, QUICK_STATE_SYNC, RESTART, RESET_*, TAUNT, etc.)
      this.onMessage(data)
    }
  }

  send(data) {
    if (!data.msgId) {
      data.msgId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    }
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
