// User Authentication, Profile, and Weekly Leaderboard Store
import { syncProfileToCloud, recordCloudMatchWin } from './supabaseClient'
import { ASSETS, getAsset } from './assets'

// Unambiguous Base32 charset (excludes 0, O, 1, I to eliminate visual confusion)
// 32^6 = 1,073,741,824 unique combinations (> 1 Billion rooms, zero collision)
const ROOM_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateRoomCode(prefix = 'PV', length = 6) {
  let result = ''
  const len = ROOM_CHARSET.length
  for (let i = 0; i < length; i++) {
    result += ROOM_CHARSET[Math.floor(Math.random() * len)]
  }
  return prefix ? `${prefix}-${result}` : result
}

export function normalizeRoomCode(input, defaultPrefix = 'PV') {
  if (!input) return ''
  const trimmed = input.trim().toUpperCase()
  if (trimmed.includes('-')) {
    return trimmed
  }
  return defaultPrefix ? `${defaultPrefix}-${trimmed}` : trimmed
}

const DEFAULT_AVATARS = [
  { id: 'shield_blue', name: 'Blue Shield', src: ASSETS.avatarBlue },
  { id: 'shield_green', name: 'Green Shield', src: ASSETS.avatarGreen },
  { id: 'shield_purple', name: 'Purple Shield', src: ASSETS.avatarPurple },
  { id: 'shield_orange', name: 'Orange Shield', src: ASSETS.avatarOrange },
  { id: 'shield_red', name: 'Red Shield', src: ASSETS.avatarRed },
  { id: 'shield_cyan', name: 'Cyan Shield', src: ASSETS.avatarCyan },
]

export { DEFAULT_AVATARS, getAsset }

// Initial Weekly Leaderboard Seed Data (Real players only)
const INITIAL_LEADERBOARD = []

export function loadUser() {
  if (typeof window === 'undefined') return getGuestUser()
  try {
    const raw = localStorage.getItem('pv_user_profile')
    if (raw) {
      const parsed = JSON.parse(raw)
      // Upgrade any old avatar to one of the new shield icons and resolve via Vite bundle
      if (!parsed.avatar || !parsed.avatar.includes('avatar-')) {
        parsed.avatar = ASSETS.avatarBlue
      } else {
        parsed.avatar = getAsset(parsed.avatar)
      }
      // Sanitize legacy 120 points from old login bug: points only come from real online wins
      if ((!parsed.wins || parsed.wins === 0) && parsed.points > 0) {
        parsed.points = 0
        parsed.badge = 'Bronze'
        localStorage.setItem('pv_user_profile', JSON.stringify(parsed))
      }
      return parsed
    }
  } catch (e) {}
  return getGuestUser()
}

export function getGuestUser() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  return {
    id: `guest_${randomSuffix}`,
    username: `Guest_${randomSuffix}`,
    isGuest: true,
    avatar: ASSETS.avatarBlue,
    wins: 0,
    losses: 0,
    points: 0,
    streak: 0,
    badge: 'Novice',
  }
}

export function getRandomAvatar() {
  const avatars = DEFAULT_AVATARS.map((a) => a.src)
  return avatars[Math.floor(Math.random() * avatars.length)]
}

export function saveUser(user) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('pv_user_profile', JSON.stringify(user))
  } catch (e) {}
}

export function saveRoomState(roomCode, state) {
  if (typeof window === 'undefined' || !roomCode) return
  try {
    const payload = {
      ...state,
      savedAt: Date.now(),
    }
    localStorage.setItem(`pv_room_state_${roomCode}`, JSON.stringify(payload))
  } catch (e) {}
}

export function loadRoomState(roomCode) {
  if (typeof window === 'undefined' || !roomCode) return null
  try {
    const raw = localStorage.getItem(`pv_room_state_${roomCode}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Expire states older than 4 hours
    if (Date.now() - (parsed.savedAt || 0) > 4 * 60 * 60 * 1000) {
      localStorage.removeItem(`pv_room_state_${roomCode}`)
      return null
    }
    return parsed
  } catch (e) {
    return null
  }
}

export function saveRoomRole(roomCode, role) {
  if (typeof window === 'undefined' || !roomCode) return
  try {
    const code = roomCode.trim().toUpperCase()
    sessionStorage.setItem(`pv_room_role_${code}`, role)
    localStorage.setItem(`pv_room_role_${code}`, role)
  } catch (e) {}
}

export function getRoomRole(roomCode) {
  if (typeof window === 'undefined' || !roomCode) return null
  try {
    const code = roomCode.trim().toUpperCase()
    return sessionStorage.getItem(`pv_room_role_${code}`) || localStorage.getItem(`pv_room_role_${code}`)
  } catch (e) {
    return null
  }
}

export function saveRoomGame(roomCode, game) {
  if (typeof window === 'undefined' || !roomCode) return
  try {
    const code = roomCode.trim().toUpperCase()
    localStorage.setItem(`pv_room_game_${code}`, game)
  } catch (e) {}
}

export function getRoomGame(roomCode) {
  if (typeof window === 'undefined' || !roomCode) return null
  try {
    const code = roomCode.trim().toUpperCase()
    return localStorage.getItem(`pv_room_game_${code}`)
  } catch (e) {
    return null
  }
}

export function clearRoomState(roomCode) {
  if (typeof window === 'undefined' || !roomCode) return
  try {
    const code = roomCode.trim().toUpperCase()
    localStorage.removeItem(`pv_room_state_${code}`)
    sessionStorage.removeItem(`pv_room_role_${code}`)
    localStorage.removeItem(`pv_room_role_${code}`)
    localStorage.removeItem(`pv_room_game_${code}`)
  } catch (e) {}
}

export function markRoomClosed(roomCode) {
  if (typeof window === 'undefined' || !roomCode) return
  try {
    const code = roomCode.trim().toUpperCase()
    const raw = localStorage.getItem('pv_closed_rooms')
    const closed = raw ? JSON.parse(raw) : {}
    closed[code] = Date.now()
    localStorage.setItem('pv_closed_rooms', JSON.stringify(closed))
    clearRoomState(code)
  } catch (e) {}
}

export function isRoomClosed(roomCode) {
  if (typeof window === 'undefined' || !roomCode) return false
  try {
    const code = roomCode.trim().toUpperCase()
    const raw = localStorage.getItem('pv_closed_rooms')
    if (!raw) return false
    const closed = JSON.parse(raw)
    return Boolean(closed[code])
  } catch (e) {
    return false
  }
}

// ── 1v1 Matchmaking Active Session Persistence ──
export function saveActive1v1Match(match) {
  if (typeof window === 'undefined' || !match || !match.roomCode) return
  try {
    const payload = {
      ...match,
      savedAt: match.savedAt || Date.now(),
      lastActiveAt: Date.now(),
    }
    localStorage.setItem('pv_active_1v1_match', JSON.stringify(payload))
  } catch (e) {}
}

export function touchActive1v1Match() {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem('pv_active_1v1_match')
    if (!raw) return
    const parsed = JSON.parse(raw)
    parsed.lastActiveAt = Date.now()
    localStorage.setItem('pv_active_1v1_match', JSON.stringify(parsed))
  } catch (e) {}
}

export function getActive1v1Match() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('pv_active_1v1_match')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const elapsed = Date.now() - (parsed.lastActiveAt || parsed.savedAt || 0)
    // Matches older than 35 seconds without active heartbeat, or closed rooms, are expired!
    if (!parsed.roomCode || isRoomClosed(parsed.roomCode) || elapsed > 35 * 1000) {
      localStorage.removeItem('pv_active_1v1_match')
      return null
    }
    return parsed
  } catch (e) {
    return null
  }
}

export function clearActive1v1Match() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('pv_active_1v1_match')
  } catch (e) {}
}

export function loadLeaderboard() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('pv_leaderboard')
    if (raw) {
      const parsed = JSON.parse(raw)
      return (parsed || []).filter((p) => p && p.id && !p.isGuest && !p.is_guest)
    }
  } catch (e) {}
  return []
}

export function saveLeaderboard(lb) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('pv_leaderboard', JSON.stringify(lb))
  } catch (e) {}
}

function updateLocalLeaderboard(user) {
  if (!user || user.isGuest) return
  const lb = loadLeaderboard()
  const existingIdx = lb.findIndex((p) => p.id === user.id)
  if (existingIdx !== -1) {
    lb[existingIdx] = {
      ...lb[existingIdx],
      wins: user.wins,
      points: user.points,
      streak: user.streak,
      badge: user.badge,
      avatar: user.avatar,
    }
  } else {
    lb.push({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      wins: user.wins,
      losses: user.losses || 0,
      points: user.points,
      streak: user.streak,
      badge: user.badge,
    })
  }

  // Re-sort by points desc
  lb.sort((a, b) => b.points - a.points || b.wins - a.wins)
  lb.forEach((item, idx) => {
    item.rank = idx + 1
  })
  saveLeaderboard(lb)
}

// Record match outcome for user and update weekly points/wins
export function recordMatchResult({ isWin, mode, scoreDiff = 0, currentUser, roomCode = '' }) {
  const user = { ...currentUser }

  if (isWin) {
    user.wins = (user.wins || 0) + 1
    user.streak = (user.streak || 0) + 1

    // Weekly Leaderboard points are SOLELY awarded for 1v1 Online Matchmaking wins!
    if (!user.isGuest && mode === 'matchmaking') {
      let earned = 25

      // Dominance bonus for 40+ point lead
      if (scoreDiff >= 40) earned += 5

      user.points = (user.points || 0) + earned

      // Update badge
      if (user.points >= 1000) user.badge = 'Grandmaster'
      else if (user.points >= 750) user.badge = 'Master'
      else if (user.points >= 500) user.badge = 'Diamond'
      else if (user.points >= 250) user.badge = 'Platinum'
      else if (user.points >= 100) user.badge = 'Gold'
      else user.badge = 'Silver'

      // Update local weekly leaderboard optimistically
      updateLocalLeaderboard(user)

      // Authoritative Server-Side Win Recording (Supabase RPC)
      // Calls Postgres stored procedure `record_match_win` to prevent client points tampering
      recordCloudMatchWin({ userId: user.id, roomCode, scoreDiff })
        .then((cloudResult) => {
          if (cloudResult && cloudResult.success) {
            const authoritativeUser = {
              ...user,
              points: cloudResult.points,
              wins: cloudResult.wins,
              streak: cloudResult.streak,
              badge: cloudResult.badge,
            }
            saveUser(authoritativeUser)
            updateLocalLeaderboard(authoritativeUser)
          } else {
            // Graceful fallback to client sync if RPC has not been migrated yet
            syncProfileToCloud(user)
          }
        })
        .catch(() => {
          syncProfileToCloud(user)
        })
    }
  } else {
    user.losses = (user.losses || 0) + 1
    user.streak = 0
    if (!user.isGuest) {
      syncProfileToCloud(user)
    }
  }

  saveUser(user)
  return user
}

// Manually trigger profile sync to cloud (e.g. after login or profile edit)
export function syncUserToCloud(user) {
  if (user && !user.isGuest) {
    syncProfileToCloud(user)
  }
}

// Calculate remaining time for current week (resets Sunday 23:59:59 UTC)
export function getWeeklyResetTime() {
  const now = new Date()
  const day = now.getUTCDay()
  const daysUntilSunday = (7 - day) % 7
  const nextSunday = new Date(now)
  nextSunday.setUTCDate(now.getUTCDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday))
  nextSunday.setUTCHours(23, 59, 59, 999)

  const diffMs = nextSunday - now
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60)

  return `${days}d ${hours}h ${minutes}m`
}
