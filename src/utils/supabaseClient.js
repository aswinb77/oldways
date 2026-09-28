import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://pfctgzrhqtvrdxdzxyfo.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_AzxDSNZTl9dQkKlh-J2Kkg_Hpzcu-zS'

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null

// In-memory cache & deduplication to protect Supabase DB under high CCU (1k - 10k players)
let cachedLeaderboard = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 25000 // 25 seconds TTL
let inFlightLeaderboardPromise = null

// Throttle profile syncs
let pendingSyncTimer = null
let latestUserToSync = null

/**
 * Fetch top players from Supabase for the global leaderboard
 * Includes in-memory caching and request deduplication to prevent DB connection spikes
 */
export async function fetchGlobalLeaderboard(limit = 50, force = false) {
  if (!supabase) return null

  const now = Date.now()
  if (!force && cachedLeaderboard && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedLeaderboard
  }

  // Deduplicate concurrent in-flight requests
  if (inFlightLeaderboardPromise) {
    return inFlightLeaderboardPromise
  }

  inFlightLeaderboardPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar, points, wins, losses, streak, badge, is_guest, updated_at')
        .eq('is_guest', false)
        .gt('points', 0)
        .order('points', { ascending: false })
        .order('wins', { ascending: false })
        .limit(limit)

      if (error) {
        console.warn('[Supabase] fetchGlobalLeaderboard error:', error.message)
        return cachedLeaderboard || null
      }

      if (data && data.length > 0) {
        const mapped = data.map((item, idx) => ({
          ...item,
          rank: idx + 1,
        }))
        cachedLeaderboard = mapped
        cacheTimestamp = Date.now()
        return mapped
      }

      cachedLeaderboard = []
      cacheTimestamp = Date.now()
      return []
    } catch (err) {
      console.warn('[Supabase] Network/fetch error:', err)
      return cachedLeaderboard || null
    } finally {
      inFlightLeaderboardPromise = null
    }
  })()

  return inFlightLeaderboardPromise
}

/**
 * Authoritative Server-Side Win Recording via Supabase RPC
 * Prevents client-side points tampering and leaderboard exploits.
 * Calls Postgres stored procedure `record_match_win` which verifies room code,
 * enforces point limits, and atomically increments user points/wins.
 */
export async function recordCloudMatchWin({ userId, roomCode, scoreDiff = 0 }) {
  if (!supabase || !userId) return null

  try {
    const { data, error } = await supabase.rpc('record_match_win', {
      p_user_id: userId,
      p_room_code: roomCode || 'UNKNOWN',
      p_score_diff: Math.max(0, Number(scoreDiff) || 0),
    })

    if (!error && data && data.success) {
      // Invalidate cached leaderboard so fresh data is fetched on next display
      cacheTimestamp = 0
      return data // { success: true, earned, points, wins, streak, badge }
    }

    if (error) {
      console.warn('[Supabase] record_match_win RPC notice (falling back):', error.message)
    }
  } catch (err) {
    console.warn('[Supabase] record_match_win call failed:', err)
  }

  return null
}

/**
 * Sync player profile and points to Supabase in the background
 * Debounced to coalesce rapid updates
 */
export async function syncProfileToCloud(user) {
  if (!supabase || !user || !user.id || user.isGuest) return false

  latestUserToSync = user

  if (pendingSyncTimer) {
    return true
  }

  pendingSyncTimer = setTimeout(async () => {
    pendingSyncTimer = null
    const target = latestUserToSync
    if (!target || !target.id) return

    try {
      const payload = {
        id: target.id,
        username: target.username || 'Anonymous Player',
        avatar: target.avatar || '/assets/avatar-red.png',
        points: Number(target.points) || 0,
        wins: Number(target.wins) || 0,
        losses: Number(target.losses) || 0,
        streak: Number(target.streak) || 0,
        badge: target.badge || 'Bronze',
        is_guest: !!target.isGuest,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })

      if (error) {
        console.warn('[Supabase] syncProfileToCloud error:', error.message)
      } else {
        // Invalidate cached leaderboard so fresh data is fetched on next display
        cacheTimestamp = 0
      }
    } catch (err) {
      console.warn('[Supabase] syncProfileToCloud failed:', err)
    }
  }, 400)

  return true
}

/**
 * Subscribe to realtime updates on profiles table
 * Throttled to a minimum 15-second debounce window to prevent Postgres connection storms
 */
export function subscribeToLeaderboard(onUpdate) {
  if (!supabase) return () => {}

  let throttleTimer = null
  let pendingUpdate = false

  const triggerUpdate = () => {
    if (throttleTimer) {
      pendingUpdate = true
      return
    }

    // Invalidate local cache timestamp
    cacheTimestamp = 0
    onUpdate && onUpdate()

    throttleTimer = setTimeout(() => {
      throttleTimer = null
      if (pendingUpdate) {
        pendingUpdate = false
        cacheTimestamp = 0
        onUpdate && onUpdate()
      }
    }, 15000)
  }

  try {
    const channel = supabase
      .channel('realtime:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          triggerUpdate()
        }
      )
      .subscribe()

    return () => {
      if (throttleTimer) clearTimeout(throttleTimer)
      supabase.removeChannel(channel)
    }
  } catch (err) {
    console.warn('[Supabase] Realtime subscription error:', err)
    return () => {}
  }
}
