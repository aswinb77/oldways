// User Authentication, Profile, and Weekly Leaderboard Store

const DEFAULT_AVATARS = [
  { id: 'aswin', name: 'Aswin Hero', src: '/assets/aswin-avatar.png' },
  { id: 'aswinduo', name: 'Duo Companion', src: '/assets/aswin-duo.png' },
  { id: 'cat', name: 'Cool Cat', src: '/assets/catlook.png' },
  { id: 'crane', name: 'Paper Crane', src: '/assets/papercrane.png' },
  { id: 'shield_blue', name: 'Blue Knight', src: '/assets/shield-code-blue.png' },
  { id: 'shield_orange', name: 'Fire Guardian', src: '/assets/shield-code-orange.png' },
  { id: 'shield_edu', name: 'Scholar', src: '/assets/shield-edu.png' },
]

export { DEFAULT_AVATARS }

// Initial Weekly Leaderboard Seed Data
const INITIAL_LEADERBOARD = [
  { rank: 1, id: 'u_1', username: 'Rahul_Kochi', avatar: '/assets/aswin-avatar.png', wins: 48, losses: 6, points: 1240, streak: 7, badge: 'Grandmaster' },
  { rank: 2, id: 'u_2', username: 'Ananya_TVM', avatar: '/assets/catlook.png', wins: 42, losses: 9, points: 1080, streak: 5, badge: 'Master' },
  { rank: 3, id: 'u_3', username: 'Midhun_Calicut', avatar: '/assets/shield-code-blue.png', wins: 37, losses: 11, points: 940, streak: 3, badge: 'Master' },
  { rank: 4, id: 'u_4', username: 'Sneha_Thrissur', avatar: '/assets/aswin-duo.png', wins: 31, losses: 8, points: 810, streak: 4, badge: 'Diamond' },
  { rank: 5, id: 'u_5', username: 'Arjun_Kollam', avatar: '/assets/shield-code-orange.png', wins: 28, losses: 14, points: 720, streak: 2, badge: 'Diamond' },
  { rank: 6, id: 'u_6', username: 'Fathima_Malappuram', avatar: '/assets/papercrane.png', wins: 25, losses: 10, points: 650, streak: 1, badge: 'Platinum' },
  { rank: 7, id: 'u_7', username: 'Vishnu_Palakkad', avatar: '/assets/shield-edu.png', wins: 22, losses: 12, points: 580, streak: 2, badge: 'Platinum' },
  { rank: 8, id: 'u_8', username: 'Devika_Alappuzha', avatar: '/assets/catlook.png', wins: 19, losses: 9, points: 510, streak: 0, badge: 'Gold' },
]

export function loadUser() {
  if (typeof window === 'undefined') return getGuestUser()
  try {
    const raw = localStorage.getItem('pv_user_profile')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return getGuestUser()
}

export function getGuestUser() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  return {
    id: `guest_${randomSuffix}`,
    username: `Guest_${randomSuffix}`,
    isGuest: true,
    avatar: '/assets/aswin-avatar.png',
    wins: 0,
    losses: 0,
    points: 0,
    streak: 0,
    badge: 'Novice',
  }
}

export function saveUser(user) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('pv_user_profile', JSON.stringify(user))
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

    // Leaderboard points are strictly awarded to logged-in players
    if (!user.isGuest) {
      let earned = 0
      if (mode === 'matchmaking') earned = 25
      else if (mode === 'friend') earned = 15
      else if (mode === 'bot') earned = 10

      // bonus for large score margin
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
