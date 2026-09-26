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

/**
 * Fetch top players from Supabase for the global leaderboard
 */
export async function fetchGlobalLeaderboard(limit = 50) {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar, points, wins, losses, streak, badge, is_guest, updated_at')
      .eq('is_guest', false)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[Supabase] fetchGlobalLeaderboard error:', error.message)
      return null
    }

    if (data && data.length > 0) {
      return data.map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }))
    }

    return []
  } catch (err) {
    console.warn('[Supabase] Network/fetch error:', err)
    return null
  }
}

/**
 * Sync player profile and points to Supabase in the background
 */
export async function syncProfileToCloud(user) {
  if (!supabase || !user || !user.id) return false

  try {
    const payload = {
      id: user.id,
      username: user.username || 'Anonymous Player',
      avatar: user.avatar || '/assets/avatar-red.png',
      points: Number(user.points) || 0,
      wins: Number(user.wins) || 0,
      losses: Number(user.losses) || 0,
      streak: Number(user.streak) || 0,
      badge: user.badge || 'Bronze',
      is_guest: !!user.isGuest,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })

    if (error) {
      console.warn('[Supabase] syncProfileToCloud error:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn('[Supabase] syncProfileToCloud failed:', err)
    return false
  }
}

/**
 * Subscribe to realtime updates on profiles table
 */
export function subscribeToLeaderboard(onUpdate) {
  if (!supabase) return () => {}

  try {
    const channel = supabase
      .channel('realtime:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          onUpdate && onUpdate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  } catch (err) {
    console.warn('[Supabase] Realtime subscription error:', err)
    return () => {}
  }
}
