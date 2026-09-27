import { supabase } from './supabaseClient'

/**
 * Cloud-Backed 1v1 Online Matchmaker powered by Supabase Realtime Presence & Broadcast
 * Optimized for 1,000 - 10,000 CCU:
 * - 2-Way MATCH_OFFER -> MATCH_ACCEPT handshake eliminates multi-host collisions
 * - Randomized jitter on pool evaluation prevents thundering-herd spikes
 * - Priority matching based on search wait time (FIFO)
 * - Immediate presence untracking on match confirmation to keep channel footprint ultra-lean
 */
export class SupabaseMatchmaker {
  constructor({ user, selectedGame = 'poojyam', onMatchFound, onStatusUpdate }) {
    this.user = user
    this.selectedGame = selectedGame
    this.onMatchFound = onMatchFound
    this.onStatusUpdate = onStatusUpdate || (() => {})

    this.channel = null
    this.matched = false
    this.isDestroyed = false
    this.timer = null
    this.secondsElapsed = 0

    this.pendingOffer = null
    this.evalTimer = null

    this.init()
  }

  async init() {
    if (!supabase) {
      this.onStatusUpdate({
        state: 'error',
        message: 'Could not connect to matchmaking cloud service.',
      })
      return
    }

    this.onStatusUpdate({
      state: 'searching',
      message: 'Entering matchmaking pool...',
      seconds: 0,
    })

    // Start search elapsed timer
    this.timer = setInterval(() => {
      if (this.matched || this.isDestroyed) return
      this.secondsElapsed += 1

      const formatted = `${Math.floor(this.secondsElapsed / 60)}:${(this.secondsElapsed % 60).toString().padStart(2, '0')}`
      this.onStatusUpdate({
        state: 'searching',
        message: `Searching for live 1v1 opponent (${formatted})...`,
        seconds: this.secondsElapsed,
      })
    }, 1000)

    try {
      const channelName = `pv_matchmaking_${this.selectedGame}`
      this.channel = supabase.channel(channelName, {
        config: {
          presence: { key: this.user.id },
          broadcast: { self: false },
        },
      })

      // 1. Listen for MATCH_OFFER
      this.channel.on('broadcast', { event: 'MATCH_OFFER' }, ({ payload }) => {
        if (this.matched || this.isDestroyed || !payload) return

        if (payload.guestId === this.user.id) {
          // If we already committed to another offer, decline
          if (this.matched || (this.pendingOffer && this.pendingOffer.offerId !== payload.offerId)) {
            this.channel.send({
              type: 'broadcast',
              event: 'MATCH_DECLINE',
              payload: { offerId: payload.offerId, guestId: this.user.id },
            })
            return
          }

          // Accept offer
          this.matched = true
          this.channel.send({
            type: 'broadcast',
            event: 'MATCH_ACCEPT',
            payload: {
              offerId: payload.offerId,
              hostId: payload.hostId,
              guestId: this.user.id,
              roomCode: payload.roomCode,
              game: payload.game || this.selectedGame,
            },
          })

          this.onStatusUpdate({ state: 'matched', message: 'Opponent found! Entering duel...' })
          setTimeout(() => {
            this.cleanup()
          }, 400)

          this.onMatchFound({
            roomCode: payload.roomCode,
            isHost: false,
            opponentProfile: payload.hostProfile,
            selectedGame: payload.game || this.selectedGame,
          })
        }
      })

      // 2. Listen for MATCH_ACCEPT
      this.channel.on('broadcast', { event: 'MATCH_ACCEPT' }, ({ payload }) => {
        if (this.matched || this.isDestroyed || !payload) return

        if (this.pendingOffer && payload.offerId === this.pendingOffer.offerId && payload.hostId === this.user.id) {
          this.matched = true
          if (this.pendingOffer.expireTimer) {
            clearTimeout(this.pendingOffer.expireTimer)
          }

          const confirmedOffer = this.pendingOffer
          this.pendingOffer = null

          this.onStatusUpdate({ state: 'matched', message: 'Match confirmed! Connecting...' })
          setTimeout(() => {
            this.cleanup()
          }, 400)

          this.onMatchFound({
            roomCode: confirmedOffer.roomCode,
            isHost: true,
            opponentProfile: confirmedOffer.opponent,
            selectedGame: this.selectedGame,
          })
        }
      })

      // 3. Listen for MATCH_DECLINE
      this.channel.on('broadcast', { event: 'MATCH_DECLINE' }, ({ payload }) => {
        if (!payload || !this.pendingOffer) return
        if (payload.offerId === this.pendingOffer.offerId) {
          if (this.pendingOffer.expireTimer) {
            clearTimeout(this.pendingOffer.expireTimer)
          }
          this.pendingOffer = null
          this.schedulePoolEvaluation(80)
        }
      })

      // 4. Presence Sync: detect waiting players
      this.channel.on('presence', { event: 'sync' }, () => {
        this.schedulePoolEvaluation()
      })

      this.channel.on('presence', { event: 'join' }, () => {
        this.schedulePoolEvaluation()
      })

      // Subscribe and track presence in pool
      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && !this.matched && !this.isDestroyed) {
          await this.channel.track({
            userId: this.user.id,
            username: this.user.username,
            avatar: this.user.avatar,
            badge: this.user.badge || 'Bronze',
            points: Number(this.user.points) || 0,
            isGuest: !!this.user.isGuest,
            game: this.selectedGame,
            searchingAt: Date.now(),
          })
        }
      })
    } catch (err) {
      console.warn('[Matchmaker] Error initializing:', err)
      this.onStatusUpdate({ state: 'error', message: 'Failed to connect to matchmaking server.' })
    }
  }

  schedulePoolEvaluation(customJitter) {
    if (this.matched || this.isDestroyed || this.pendingOffer) return

    if (this.evalTimer) {
      clearTimeout(this.evalTimer)
    }

    // Jitter 40ms - 150ms to break lockstep race conditions
    const jitter = customJitter || (Math.floor(Math.random() * 110) + 40)
    this.evalTimer = setTimeout(() => {
      this.evaluatePool()
    }, jitter)
  }

  evaluatePool() {
    if (this.matched || this.isDestroyed || this.pendingOffer || !this.channel) return

    const presenceState = this.channel.presenceState()
    const allKeys = Object.keys(presenceState)

    // Collect all other searching players
    const candidates = []
    for (const key of allKeys) {
      if (key === this.user.id) continue
      const presences = presenceState[key]
      if (presences && presences.length > 0) {
        const candidate = presences[0]
        if (candidate && candidate.userId) {
          candidates.push(candidate)
        }
      }
    }

    if (candidates.length === 0) return

    // Prioritize candidate waiting longest (FIFO fairness)
    candidates.sort((a, b) => (a.searchingAt || 0) - (b.searchingAt || 0))
    const opponent = candidates[0]

    // Deterministic host role: lower userId acts as match offerer
    const isHost = this.user.id < opponent.userId

    if (isHost) {
      const offerId = `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const randomSuffix = Math.floor(1000 + Math.random() * 9000)
      const privateRoomCode = `MATCH-${randomSuffix}`

      const expireTimer = setTimeout(() => {
        if (this.pendingOffer && this.pendingOffer.offerId === offerId) {
          this.pendingOffer = null
          this.schedulePoolEvaluation(50)
        }
      }, 2000)

      this.pendingOffer = {
        offerId,
        guestId: opponent.userId,
        roomCode: privateRoomCode,
        opponent,
        expireTimer,
      }

      // Broadcast offer directly to opponent
      this.channel.send({
        type: 'broadcast',
        event: 'MATCH_OFFER',
        payload: {
          offerId,
          roomCode: privateRoomCode,
          hostId: this.user.id,
          guestId: opponent.userId,
          hostProfile: {
            id: this.user.id,
            username: this.user.username,
            avatar: this.user.avatar,
            badge: this.user.badge,
            points: this.user.points,
            isGuest: this.user.isGuest,
          },
          guestProfile: {
            id: opponent.userId,
            username: opponent.username,
            avatar: opponent.avatar,
            badge: opponent.badge,
            points: opponent.points,
            isGuest: opponent.isGuest,
          },
          game: this.selectedGame,
        },
      })
    }
  }

  cleanup() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.evalTimer) {
      clearTimeout(this.evalTimer)
      this.evalTimer = null
    }
    if (this.pendingOffer?.expireTimer) {
      clearTimeout(this.pendingOffer.expireTimer)
      this.pendingOffer = null
    }
    if (this.channel && supabase) {
      try {
        this.channel.untrack()
        supabase.removeChannel(this.channel)
      } catch (e) {}
      this.channel = null
    }
  }

  destroy() {
    this.isDestroyed = true
    this.cleanup()
  }
}
