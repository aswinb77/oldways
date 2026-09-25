// First-Come-First-Served (FCFS) Real-Time 1v1 Matchmaker
// Allows any 2 online players across the network to automatically pair up first-come-first-served.
import { Peer } from 'peerjs'

const PRIMARY_QUEUE_SLOT = 'pv-fcfs-pool-alpha'
const BACKUP_QUEUE_SLOT = 'pv-fcfs-pool-beta'

export class FCFSMatchmaker {
  constructor({ user, onMatchFound, onStatusUpdate }) {
    this.user = user
    this.onMatchFound = onMatchFound
    this.onStatusUpdate = onStatusUpdate || (() => {})

    this.isDestroyed = false
    this.matched = false
    this.isWaitingHost = false
    this.peer = null
    this.conn = null
    this.bc = null
    this.timer = null
    this.currentSlot = PRIMARY_QUEUE_SLOT

    this.init()
  }

  init() {
    this.onStatusUpdate({ state: 'searching', message: 'Checking global matchmaking queue...' })

    // 1. Setup BroadcastChannel for instant local cross-tab pairing
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel('pv_fcfs_queue_bc')
        this.bc.onmessage = (e) => this.handleBroadcastMessage(e.data)
        // Broadcast presence in case another tab is waiting
        this.bc.postMessage({
          type: 'BC_SEEKER_PING',
          profile: this.user,
          timestamp: Date.now(),
        })
      } catch (err) {
        console.warn('BroadcastChannel error:', err)
      }
    }

    // 2. Start WebRTC Probe to find an existing waiting host in the queue
    this.probeQueueSlot(this.currentSlot)
  }

  handleBroadcastMessage(data) {
    if (this.matched || this.isDestroyed || !data) return

    if (data.type === 'BC_SEEKER_PING' && this.isWaitingHost) {
      // We are waiting as host, and a local tab just pinged us!
      const privateRoomCode = `MATCH-${Math.floor(1000 + Math.random() * 9000)}`
      this.matched = true
      this.bc.postMessage({
        type: 'BC_MATCH_ACCEPTED',
        privateRoomCode,
        hostProfile: this.user,
        targetTimestamp: data.timestamp,
      })
      this.triggerMatchFound({
        roomCode: privateRoomCode,
        isHost: true,
        opponentProfile: data.profile,
      })
    } else if (data.type === 'BC_MATCH_ACCEPTED' && !this.isWaitingHost && !this.matched) {
      this.matched = true
      this.triggerMatchFound({
        roomCode: data.privateRoomCode,
        isHost: false,
        opponentProfile: data.hostProfile,
      })
    }
  }

  // Attempt to connect to a waiting host in the specified slot
  probeQueueSlot(slotId) {
    if (this.matched || this.isDestroyed) return

    const tempSeekerId = `pv-seeker-${Math.random().toString(36).substring(2, 8)}`
    
    try {
      this.peer = new Peer(tempSeekerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      })

      let connectTimeout = null

      this.peer.on('open', () => {
        if (this.matched || this.isDestroyed) return

        this.onStatusUpdate({ state: 'probing', message: 'Checking for waiting players...' })
        const connection = this.peer.connect(slotId, { reliable: true })

        connectTimeout = setTimeout(() => {
          if (!this.matched && !this.isWaitingHost) {
            // No response from slot, become the waiting host
            this.becomeWaitingHost(slotId)
          }
        }, 1800)

        connection.on('open', () => {
          if (connectTimeout) clearTimeout(connectTimeout)
          if (this.matched || this.isDestroyed) return

          this.conn = connection
          this.onStatusUpdate({ state: 'connecting', message: 'Opponent found! Handshaking...' })

          // Send challenge to the waiting host
          this.conn.send({
            type: 'FCFS_CHALLENGE',
            profile: this.user,
          })
        })

        connection.on('data', (data) => {
          if (this.matched || this.isDestroyed) return

          if (data && data.type === 'FCFS_MATCH_ACCEPT') {
            this.matched = true
            if (connectTimeout) clearTimeout(connectTimeout)
            this.triggerMatchFound({
              roomCode: data.privateRoomCode,
              isHost: false,
              opponentProfile: data.hostProfile,
            })
          }
        })

        connection.on('error', () => {
          if (connectTimeout) clearTimeout(connectTimeout)
          if (!this.matched && !this.isWaitingHost) {
            this.becomeWaitingHost(slotId)
          }
        })
      })

      this.peer.on('error', (err) => {
        if (connectTimeout) clearTimeout(connectTimeout)
        if (err.type === 'peer-unavailable' || err.type === 'connection-closed') {
          // No host in this slot -> Become the waiting host!
          if (!this.matched && !this.isWaitingHost) {
            this.becomeWaitingHost(slotId)
          }
        }
      })
    } catch (e) {
      this.becomeWaitingHost(slotId)
    }
  }

  // Become the First-Come waiting host in the queue pool
  becomeWaitingHost(slotId) {
    if (this.matched || this.isDestroyed) return

    // Clean up temporary seeker peer
    if (this.peer) {
      try {
        this.peer.destroy()
      } catch (e) {}
      this.peer = null
    }

    this.isWaitingHost = true
    this.onStatusUpdate({
      state: 'waiting_host',
      message: 'You are #1 in Queue! Waiting for next player...',
      queuePos: 1,
    })

    try {
      this.peer = new Peer(slotId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      })

      this.peer.on('open', () => {
        if (this.isDestroyed || this.matched) return
        this.onStatusUpdate({
          state: 'waiting_host',
          message: 'Queue Slot Active. Waiting for challenger...',
          queuePos: 1,
        })
      })

      // Another player arrived and connected to our slot!
      this.peer.on('connection', (connection) => {
        if (this.matched || this.isDestroyed) return
        this.conn = connection

        this.conn.on('data', (data) => {
          if (this.matched || this.isDestroyed) return

          if (data && data.type === 'FCFS_CHALLENGE') {
            this.matched = true
            const privateRoomCode = `MATCH-${Math.floor(1000 + Math.random() * 9000)}`

            // Accept and give challenger private match room
            this.conn.send({
              type: 'FCFS_MATCH_ACCEPT',
              privateRoomCode,
              hostProfile: this.user,
            })

            // Small delay to ensure challenger receives accept before destroying queue peer
            setTimeout(() => {
              this.triggerMatchFound({
                roomCode: privateRoomCode,
                isHost: true,
                opponentProfile: data.profile,
              })
            }, 80)
          }
        })
      })

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          // Someone claimed this slot right before us! Try backup slot or re-probe
          if (slotId === PRIMARY_QUEUE_SLOT) {
            this.currentSlot = BACKUP_QUEUE_SLOT
            this.isWaitingHost = false
            setTimeout(() => this.probeQueueSlot(BACKUP_QUEUE_SLOT), 300)
          } else {
            // Re-probe primary slot as challenger
            this.currentSlot = PRIMARY_QUEUE_SLOT
            this.isWaitingHost = false
            setTimeout(() => this.probeQueueSlot(PRIMARY_QUEUE_SLOT), 500)
          }
        }
      })
    } catch (e) {
      console.warn('Host creation error:', e)
    }
  }

  triggerMatchFound(matchDetails) {
    this.cleanup()
    this.onMatchFound(matchDetails)
  }

  cleanup() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
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

  destroy() {
    this.isDestroyed = true
    this.cleanup()
  }
}
