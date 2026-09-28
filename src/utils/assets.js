// Centralized Vite-Bundled Assets Registry
// All PNG & SVG assets are imported directly so Vite includes them in the build bundle,
// inlines small assets (< 25KB), and hashes larger assets for caching.
import aswinAvatar from '../assets/aswin-avatar.png'
import aswinDuo from '../assets/aswin-duo.png'
import avatarBlue from '../assets/avatar-blue.png'
import avatarCyan from '../assets/avatar-cyan.png'
import avatarGreen from '../assets/avatar-green.png'
import avatarOrange from '../assets/avatar-orange.png'
import avatarPurple from '../assets/avatar-purple.png'
import avatarRed from '../assets/avatar-red.png'
import catlook from '../assets/catlook.png'
import papercrane from '../assets/papercrane.png'
import heroImg from '../assets/hero.png'

import shieldCert from '../assets/shield-cert.png'
import shieldCodeBlue from '../assets/shield-code-blue.png'
import shieldCodeOrange from '../assets/shield-code-orange.png'
import shieldEdu from '../assets/shield-edu.png'

import vettuSlotEmpty from '../assets/vettu-slot-empty.png'
import vettuSlotFilled from '../assets/vettu-slot-filled.png'
import vettuXBlue from '../assets/vettu-x-blue.png'
import vettuXRed from '../assets/vettu-x-red.png'

import duolingoFire from '../assets/duolingo-fire.svg'
import fireSvg from '../assets/fire.svg'
import minecraftHeart from '../assets/minecraft-heart.svg'
import faviconSvg from '../assets/favicon.svg'
import iconsSvg from '../assets/icons.svg'

export const ASSETS = {
  // Avatars
  avatarBlue,
  avatarCyan,
  avatarGreen,
  avatarOrange,
  avatarPurple,
  avatarRed,
  aswinAvatar,
  aswinDuo,
  catlook,
  papercrane,
  heroImg,

  // Shields
  shieldCert,
  shieldCodeBlue,
  shieldCodeOrange,
  shieldEdu,

  // Game pieces & slots
  vettuSlotEmpty,
  vettuSlotFilled,
  vettuXBlue,
  vettuXRed,

  // SVGs
  duolingoFire,
  fireSvg,
  minecraftHeart,
  faviconSvg,
  iconsSvg,
}

// Map legacy URL string paths to Vite-bundled assets
const LEGACY_MAP = {
  '/assets/avatar-blue.png': avatarBlue,
  '/assets/avatar-cyan.png': avatarCyan,
  '/assets/avatar-green.png': avatarGreen,
  '/assets/avatar-orange.png': avatarOrange,
  '/assets/avatar-purple.png': avatarPurple,
  '/assets/avatar-red.png': avatarRed,
  '/assets/aswin-avatar.png': aswinAvatar,
  '/assets/aswin-duo.png': aswinDuo,
  '/assets/catlook.png': catlook,
  '/assets/papercrane.png': papercrane,

  '/assets/shield-cert.png': shieldCert,
  '/assets/shield-code-blue.png': shieldCodeBlue,
  '/assets/shield-code-orange.png': shieldCodeOrange,
  '/assets/shield-edu.png': shieldEdu,

  '/assets/vettu-slot-empty.png': vettuSlotEmpty,
  '/assets/vettu-slot-filled.png': vettuSlotFilled,
  '/assets/vettu-x-blue.png': vettuXBlue,
  '/assets/vettu-x-red.png': vettuXRed,

  '/assets/duolingo-fire.svg': duolingoFire,
  '/assets/fire.svg': fireSvg,
  '/assets/minecraft-heart.svg': minecraftHeart,
  '/favicon.svg': faviconSvg,
  '/icons.svg': iconsSvg,
}

/**
 * Resolves any asset path or key to a Vite-bundled asset URL or base64 data URI
 * Ensures 100% backward compatibility for stored avatar strings in localStorage
 */
export function getAsset(pathOrKey, fallback = avatarBlue) {
  if (!pathOrKey) return fallback
  if (ASSETS[pathOrKey]) return ASSETS[pathOrKey]
  if (LEGACY_MAP[pathOrKey]) return LEGACY_MAP[pathOrKey]
  return pathOrKey
}
