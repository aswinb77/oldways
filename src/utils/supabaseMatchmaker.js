import { supabase } from './supabaseClient'

/**
 * Cloud-Backed 1v1 Online Matchmaker powered by Supabase Realtime Presence & Broadcast
 * Pairs any two online players across the network first-come-first-served.
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
      message: 'Entering global matchmaking pool...',
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

      // 1. Listen for match proposals from other players
      this.channel.on('broadcast', { event: 'MATCH_OFFER' }, ({ payload }) => {
        if (this.matched || this.isDestroyed || !payload) return

        if (payload.guestId === this.user.id) {
          this.matched = true
          this.cleanup()
          this.onStatusUpdate({ state: 'matched', message: 'Opponent found! Entering duel...' })
          this.onMatchFound({
            roomCode: payload.roomCode,
            isHost: false,
            opponentProfile: payload.hostProfile,
            selectedGame: payload.game || this.selectedGame,
          })
        }
      })

      // 2. Presence Sync: detect waiting players
      this.channel.on('presence', { event: 'sync' }, () => {
        this.evaluatePool()
      })

      this.channel.on('presence', { event: 'join' }, () => {
        this.evaluatePool()
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

  evaluatePool() {
    if (this.matched || this.isDestroyed || !this.channel) return

    const presenceState = this.channel.presenceState()
    const allKeys = Object.keys(presenceState)

    // Find any opponent who is searching in this channel
    const opponentKey = allKeys.find((key) => key !== this.user.id)
    if (!opponentKey) return

    const opponentPresences = presenceState[opponentKey]
    if (!opponentPresences || opponentPresences.length === 0) return

    const opponent = opponentPresences[0]
    if (!opponent || !opponent.userId) return

    // Deterministic leader election: lexicographically smaller userId is Host
    const isHost = this.user.id < opponent.userId

    if (isHost) {
      this.matched = true
      const randomSuffix = Math.floor(1000 + Math.random() * 9000)
      const privateRoomCode = `MATCH-${randomSuffix}`

      this.onStatusUpdate({ state: 'matched', message: 'Opponent matched! Connecting...' })

      // Broadcast the match offer to the opponent
      this.channel.send({
        type: 'broadcast',
        event: 'MATCH_OFFER',
        payload: {
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

      this.cleanup()
      this.onMatchFound({
        roomCode: privateRoomCode,
        isHost: true,
        opponentProfile: opponent,
        selectedGame: this.selectedGame,
      })
    }
  }

  cleanup() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
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
