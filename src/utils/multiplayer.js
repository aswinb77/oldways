// Real-time 1v1 Multiplayer Engine with WebRTC PeerJS + BroadcastChannel and Reconnect State Sync
import { Peer } from 'peerjs'

export class MultiplayerRoom {
  constructor({ roomCode, isHost, playerProfile, selectedGame, onMessage, onStatusChange }) {
    this.roomCode = roomCode.trim().toUpperCase()
    this.isHost = isHost
    this.playerProfile = playerProfile
    this.selectedGame = selectedGame || 'poojyam'
    this.onMessage = onMessage
    this.onStatusChange = onStatusChange

    this.peer = null
    this.conn = null
    this.bc = null
    this.connected = false
    this.remoteProfile = null
    this.isDestroyed = false
    this.handshakeInterval = null

    this.init()
  }

  init() {
    // 1. Setup BroadcastChannel for instant local cross-tab / cross-window
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(`pv_room_${this.roomCode}`)
        this.bc.onmessage = (event) => {
          this.handleIncomingRaw(event.data, 'broadcast')
        }
      } catch (err) {
        console.warn('BroadcastChannel error:', err)
      }
    }

    // 2. Setup WebRTC via PeerJS for online real-time 1v1
    this.cleanId = this.roomCode.replace(/[^A-Za-z0-9_-]/g, '')
    const peerId = this.isHost
      ? `pv-host-${this.cleanId}`
      : `pv-guest-${this.cleanId}-${Math.random().toString(36).substring(2, 7)}`

    try {
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            { urls: 'stun:stun.cloudflare.com:3478' },
          ],
        },
      })

      this.peer.on('open', (id) => {
        if (this.isDestroyed) return
        this.onStatusChange({ status: 'ready', peerId: id, isHost: this.isHost })

        // If guest, connect to the host and start auto-retry loop
        if (!this.isHost) {
          const hostPeerId = `pv-host-${this.cleanId}`
          this.connectToPeer(hostPeerId)
          this.startGuestConnectLoop()
        }

        // Broadcast presence
        this.broadcastPresence()
      })

      this.peer.on('connection', (connection) => {
        if (this.isDestroyed) return
        this.setupConnection(connection)
      })

      this.peer.on('error', (err) => {
        console.warn('PeerJS note:', err.type, err.message)
        if (err.type === 'unavailable-id' && this.isHost) {
          this.onStatusChange({ status: 'ready_local', message: 'Room active' })
        } else if (err.type === 'peer-unavailable' && !this.isHost) {
          this.onStatusChange({
            status: 'waiting_for_host',
            message: 'Waiting for your friend to open the game screen...',
          })
        }
      })
    } catch (err) {
      console.warn('PeerJS init failed, continuing with BroadcastChannel:', err)
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

      // Try reconnecting to host
      if (!this.conn || !this.conn.open) {
        this.connectToPeer(hostPeerId)
      }

      this.broadcastPresence()
      this.onStatusChange({
        status: 'retrying',
        attempt: retries,
        message: retries > 2
          ? 'Waiting for your friend to open the game screen...'
          : 'Connecting to room...',
      })
    }, 2200)
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
    }, 1500)
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
      console.warn('connectToPeer exception:', e)
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
      this.connected = false
      this.onStatusChange({ status: 'disconnected', message: 'Opponent temporarily disconnected' })
      this.startPresenceLoop()
      if (!this.isHost) {
        this.startGuestConnectLoop()
      }
    })

    this.conn.on('error', (err) => {
      console.warn('Connection error:', err)
    })
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

    // Handshake & Presence handling
    if (data.type === 'HOST_ONLINE' && !this.isHost) {
      this.remoteProfile = data.profile
      if (data.selectedGame) this.selectedGame = data.selectedGame
      if (!this.connected) {
        this.markConnected(data.selectedGame)
        this.sendRaw({
          type: 'GUEST_ONLINE',
          profile: this.playerProfile,
          selectedGame: this.selectedGame,
        })
      }
    } else if (data.type === 'GUEST_ONLINE' && this.isHost) {
      this.remoteProfile = data.profile
      if (!this.connected) {
        this.markConnected(this.selectedGame)
        this.sendRaw({
          type: 'HOST_WELCOME',
          profile: this.playerProfile,
          selectedGame: this.selectedGame,
        })
      }
    } else if (data.type === 'HOST_WELCOME') {
      this.remoteProfile = data.profile
      if (data.selectedGame) this.selectedGame = data.selectedGame
      this.markConnected(data.selectedGame)
    } else if (data.type === 'HANDSHAKE') {
      this.remoteProfile = data.profile
      if (data.selectedGame && !this.isHost) this.selectedGame = data.selectedGame
      this.markConnected(data.selectedGame)
      this.send({
        type: 'HANDSHAKE_ACK',
        profile: this.playerProfile,
        selectedGame: this.selectedGame,
      })
    } else if (data.type === 'HANDSHAKE_ACK') {
      this.remoteProfile = data.profile
      if (data.selectedGame && !this.isHost) this.selectedGame = data.selectedGame
      this.markConnected(data.selectedGame)
    } else if (data.type === 'HEARTBEAT') {
      // Keep alive response
      if (!this.connected) this.markConnected()
    } else {
      // Forward game actions (MOVE, STATE_SYNC, REQUEST_STATE, TAUNT, RESTART)
      this.onMessage(data)
    }
  }

  send(data) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(data)
      } catch (e) {
        console.warn('WebRTC send failed:', e)
      }
    }
    this.sendRaw(data)
  }

  sendRaw(data) {
    if (this.bc) {
      try {
        this.bc.postMessage(data)
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
    if (this.conn) {
      try {
        this.conn.close()
      } catch (e) {}
    }
    if (this.peer) {
      try {
        this.peer.destroy()
      } catch (e) {}
    }
    if (this.bc) {
      try {
        this.bc.close()
      } catch (e) {}
    }
  }
}
