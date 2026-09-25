// User Authentication, Profile, and Weekly Leaderboard Store

const DEFAULT_AVATARS = [
  { id: 'shield_blue', name: 'Blue Shield', src: '/assets/avatar-blue.png' },
  { id: 'shield_green', name: 'Green Shield', src: '/assets/avatar-green.png' },
  { id: 'shield_purple', name: 'Purple Shield', src: '/assets/avatar-purple.png' },
  { id: 'shield_orange', name: 'Orange Shield', src: '/assets/avatar-orange.png' },
  { id: 'shield_red', name: 'Red Shield', src: '/assets/avatar-red.png' },
  { id: 'shield_cyan', name: 'Cyan Shield', src: '/assets/avatar-cyan.png' },
]

export { DEFAULT_AVATARS }

// Initial Weekly Leaderboard Seed Data
const INITIAL_LEADERBOARD = [
  { rank: 1, id: 'u_1', username: 'Rahul_Kochi', avatar: '/assets/avatar-red.png', wins: 48, losses: 6, points: 1240, streak: 7, badge: 'Grandmaster' },
  { rank: 2, id: 'u_2', username: 'Ananya_TVM', avatar: '/assets/avatar-purple.png', wins: 42, losses: 9, points: 1080, streak: 5, badge: 'Master' },
  { rank: 3, id: 'u_3', username: 'Midhun_Calicut', avatar: '/assets/avatar-blue.png', wins: 37, losses: 11, points: 940, streak: 3, badge: 'Master' },
  { rank: 4, id: 'u_4', username: 'Sneha_Thrissur', avatar: '/assets/avatar-cyan.png', wins: 31, losses: 8, points: 810, streak: 4, badge: 'Diamond' },
  { rank: 5, id: 'u_5', username: 'Arjun_Kollam', avatar: '/assets/avatar-orange.png', wins: 28, losses: 14, points: 720, streak: 2, badge: 'Diamond' },
  { rank: 6, id: 'u_6', username: 'Fathima_Malappuram', avatar: '/assets/avatar-green.png', wins: 25, losses: 10, points: 650, streak: 1, badge: 'Platinum' },
  { rank: 7, id: 'u_7', username: 'Vishnu_Palakkad', avatar: '/assets/avatar-blue.png', wins: 22, losses: 12, points: 580, streak: 2, badge: 'Platinum' },
  { rank: 8, id: 'u_8', username: 'Devika_Alappuzha', avatar: '/assets/avatar-red.png', wins: 19, losses: 9, points: 510, streak: 0, badge: 'Gold' },
]

export function loadUser() {
  if (typeof window === 'undefined') return getGuestUser()
  try {
    const raw = localStorage.getItem('pv_user_profile')
    if (raw) {
      const parsed = JSON.parse(raw)
      // Upgrade any old avatar to one of the new shield icons
      if (!parsed.avatar || !parsed.avatar.includes('avatar-')) {
        parsed.avatar = '/assets/avatar-blue.png'
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
    avatar: '/assets/avatar-blue.png',
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

export function clearRoomState(roomCode) {
  if (typeof window === 'undefined' || !roomCode) return
  try {
    localStorage.removeItem(`pv_room_state_${roomCode}`)
  } catch (e) {}
}

export function loadLeaderboard() {
  if (typeof window === 'undefined') return INITIAL_LEADERBOARD
  try {
    const raw = localStorage.getItem('pv_leaderboard')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return INITIAL_LEADERBOARD
}

export function saveLeaderboard(lb) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('pv_leaderboard', JSON.stringify(lb))
  } catch (e) {}
}

// Record match outcome for user and update weekly points/wins
export function recordMatchResult({ isWin, mode, scoreDiff = 0, currentUser }) {
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

      // Update weekly leaderboard
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
  } else {
    user.losses = (user.losses || 0) + 1
    user.streak = 0
  }

  saveUser(user)
  return user
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
