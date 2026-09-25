// Real-time 1v1 Multiplayer Engine (WebRTC PeerJS + BroadcastChannel Cross-Tab Fallback)
import { Peer } from 'peerjs'

export class MultiplayerRoom {
  constructor({ roomCode, isHost, playerProfile, onMessage, onStatusChange }) {
    this.roomCode = roomCode.trim().toUpperCase()
    this.isHost = isHost
    this.playerProfile = playerProfile
    this.onMessage = onMessage
    this.onStatusChange = onStatusChange

    this.peer = null
    this.conn = null
    this.bc = null
    this.connected = false
    this.remoteProfile = null
    this.isDestroyed = false

    this.init()
  }

  init() {
    // 1. Setup BroadcastChannel for instant local cross-tab / cross-window testing
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
    const cleanId = this.roomCode.replace(/[^A-Za-z0-9_-]/g, '')
    const peerId = this.isHost
      ? `pv-host-${cleanId}`
      : `pv-guest-${cleanId}-${Math.random().toString(36).substring(2, 7)}`

    try {
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      })

      this.peer.on('open', (id) => {
        if (this.isDestroyed) return
        this.onStatusChange({ status: 'ready', peerId: id, isHost: this.isHost })

        // If guest, connect to the host
        if (!this.isHost) {
          const hostPeerId = `pv-host-${cleanId}`
          this.connectToPeer(hostPeerId)
        }

        // Broadcast presence locally as well
        this.sendRaw({
          type: this.isHost ? 'HOST_ONLINE' : 'GUEST_ONLINE',
          profile: this.playerProfile,
        })
      })

      this.peer.on('connection', (connection) => {
        if (this.isDestroyed) return
        this.setupConnection(connection)
      })

      this.peer.on('error', (err) => {
        console.warn('PeerJS note:', err.type, err.message)
        // If host ID is already taken, fallback smoothly to cross-tab communication
        if (err.type === 'unavailable-id' && this.isHost) {
          this.onStatusChange({ status: 'ready_local', message: 'Room active' })
        }
      })
    } catch (err) {
      console.warn('PeerJS init failed, continuing with BroadcastChannel:', err)
    }

    // Ping loop to establish local handshake
    this.handshakeInterval = setInterval(() => {
      if (this.connected || this.isDestroyed) return
      this.sendRaw({
        type: this.isHost ? 'HOST_ONLINE' : 'GUEST_ONLINE',
        profile: this.playerProfile,
      })
    }, 1500)
  }

  connectToPeer(targetId) {
    if (!this.peer || this.peer.destroyed) return
    const connection = this.peer.connect(targetId, { reliable: true })
    this.setupConnection(connection)
  }

  setupConnection(connection) {
    this.conn = connection

    this.conn.on('open', () => {
      this.markConnected()
      // Send handshake profile
      this.send({
        type: 'HANDSHAKE',
        profile: this.playerProfile,
      })
    })

    this.conn.on('data', (data) => {
      this.handleIncomingRaw(data, 'webrtc')
    })

    this.conn.on('close', () => {
      this.onStatusChange({ status: 'disconnected', message: 'Opponent disconnected' })
      this.connected = false
    })

    this.conn.on('error', (err) => {
      console.warn('Connection error:', err)
    })
  }

  markConnected() {
    if (this.connected) return
    this.connected = true
    clearInterval(this.handshakeInterval)
    this.onStatusChange({ status: 'connected', remoteProfile: this.remoteProfile })
  }

  handleIncomingRaw(data, source) {
    if (!data || typeof data !== 'object') return

    // Handshake handling
    if (data.type === 'HOST_ONLINE' && !this.isHost) {
      if (!this.connected) {
        this.remoteProfile = data.profile
        this.markConnected()
        this.sendRaw({
          type: 'GUEST_ONLINE',
          profile: this.playerProfile,
        })
      }
    } else if (data.type === 'GUEST_ONLINE' && this.isHost) {
      if (!this.connected) {
        this.remoteProfile = data.profile
        this.markConnected()
        this.sendRaw({
          type: 'HOST_WELCOME',
          profile: this.playerProfile,
        })
      }
    } else if (data.type === 'HOST_WELCOME') {
      this.remoteProfile = data.profile
      this.markConnected()
    } else if (data.type === 'HANDSHAKE') {
      this.remoteProfile = data.profile
      this.markConnected()
      this.send({
        type: 'HANDSHAKE_ACK',
        profile: this.playerProfile,
      })
    } else if (data.type === 'HANDSHAKE_ACK') {
      this.remoteProfile = data.profile
      this.markConnected()
    } else {
      // Forward game actions (MOVE, TAUNT, RESET, etc.)
      this.onMessage(data)
    }
  }

  send(data) {
    // Send via WebRTC if open
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(data)
      } catch (e) {
        console.warn('WebRTC send failed:', e)
      }
    }
    // Also send via BroadcastChannel for seamless local tabs
    this.sendRaw(data)
  }

  sendRaw(data) {
    if (this.bc) {
      try {
        this.bc.postMessage(data)
      } catch (e) {
        // ignore
      }
    }
  }

  destroy() {
    this.isDestroyed = true
    clearInterval(this.handshakeInterval)
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
