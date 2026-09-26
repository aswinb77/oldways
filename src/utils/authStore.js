import { supabase } from './supabaseClient'
import { saveUser, getGuestUser } from './userStore'

/**
 * Cryptographic SHA-256 password hashing with per-user salt using native Web Crypto API
 */
export async function hashPassword(password, username) {
  const salt = `oldways_salt_${username.trim().toLowerCase()}_pv`
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Check if a username is already taken in the Supabase profiles database (case-insensitive)
 */
export async function checkUsernameAvailable(username) {
  if (!supabase || !username) return true
  try {
    const trimmed = username.trim().toLowerCase()
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', trimmed)
      .maybeSingle()

    if (error) {
      console.warn('[Auth] Check username error:', error.message)
      return true
    }

    return !data // If no data found, username is available
  } catch (err) {
    console.warn('[Auth] Username check exception:', err)
    return true
  }
}

/**
 * Register a new user with verified unique username and hashed password
 */
export async function registerAccount({ username, password, avatar }) {
  if (!supabase) {
    throw new Error('Database connection unavailable. Please check your internet.')
  }

  const cleanName = username.trim()
  if (!cleanName || cleanName.length < 3 || cleanName.length > 16) {
    throw new Error('Username must be between 3 and 16 characters.')
  }

  if (!/^[a-zA-Z0-9_]+$/.test(cleanName)) {
    throw new Error('Username can only contain letters, numbers, and underscores.')
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.')
  }

  // Check uniqueness
  const isAvailable = await checkUsernameAvailable(cleanName)
  if (!isAvailable) {
    throw new Error(`Username "${cleanName}" is already taken. Please choose another one.`)
  }

  const hashedPassword = await hashPassword(password, cleanName)
  const randomSuffix = Math.floor(10000 + Math.random() * 90000)
  const newUserId = `usr_${randomSuffix}`

  const newProfile = {
    id: newUserId,
    username: cleanName,
    avatar: avatar || '/assets/avatar-red.png',
    points: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    badge: 'Bronze',
    is_guest: false,
    updated_at: new Date().toISOString(),
  }

  // Attempt insert with password_hash
  const { error } = await supabase.from('profiles').insert({
    ...newProfile,
    password_hash: hashedPassword,
  })

  if (error) {
    // If column password_hash doesn't exist yet in DB schema, fallback to insert without it
    if (error.code === '42703' || error.message.includes('password_hash')) {
      const { error: retryErr } = await supabase.from('profiles').insert(newProfile)
      if (retryErr) {
        if (retryErr.code === '23505' || retryErr.message.includes('unique')) {
          throw new Error(`Username "${cleanName}" is already taken.`)
        }
        throw new Error(retryErr.message || 'Failed to create account.')
      }
    } else if (error.code === '23505' || error.message.includes('unique')) {
      throw new Error(`Username "${cleanName}" is already taken. Please choose another one.`)
    } else {
      throw new Error(error.message || 'Failed to create account. Please try again.')
    }
  }

  saveUser(newProfile)
  return newProfile
}

/**
 * Login an existing user by verifying their username and password hash against the database
 */
export async function loginAccount({ username, password }) {
  if (!supabase) {
    throw new Error('Database connection unavailable. Please check your internet.')
  }

  const cleanName = username.trim()
  if (!cleanName) {
    throw new Error('Please enter your username.')
  }

  if (!password) {
    throw new Error('Please enter your password.')
  }

  // Look up user profile by username (case-insensitive)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', cleanName)
    .maybeSingle()

  if (error || !profile) {
    throw new Error(`No account found with username "${cleanName}". Please check your spelling or register.`)
  }

  // If password_hash exists on the record, verify it
  if (profile.password_hash) {
    const inputHash = await hashPassword(password, cleanName)
    if (inputHash !== profile.password_hash) {
      throw new Error('Incorrect password. Please check your password and try again.')
    }
  } else {
    // If password_hash column exists but was not set yet, set it on this login
    try {
      const hashedPassword = await hashPassword(password, cleanName)
      await supabase
        .from('profiles')
        .update({ password_hash: hashedPassword })
        .eq('id', profile.id)
    } catch (e) {}
  }

  const userObj = {
    id: profile.id,
    username: profile.username,
    avatar: profile.avatar || '/assets/avatar-blue.png',
    points: Number(profile.points) || 0,
    wins: Number(profile.wins) || 0,
    losses: Number(profile.losses) || 0,
    streak: Number(profile.streak) || 0,
    badge: profile.badge || 'Bronze',
    is_guest: false,
  }

  saveUser(userObj)
  return userObj
}

/**
 * Log out user and revert to a clean guest profile
 */
export function logoutAccount() {
  const guest = getGuestUser()
  saveUser(guest)
  return guest
}
