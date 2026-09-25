// Web Audio API Sound Synthesizer for Poojyam Vettu
class SoundController {
  constructor() {
    this.ctx = null
    this.muted = false
    try {
      const saved = localStorage.getItem('pv_sound_muted')
      if (saved !== null) {
        this.muted = JSON.parse(saved)
      }
    } catch (e) {
      // ignore
    }
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  toggleMute() {
    this.muted = !this.muted
    try {
      localStorage.setItem('pv_sound_muted', JSON.stringify(this.muted))
    } catch (e) {
      // ignore
    }
    return this.muted
  }

  isMuted() {
    return this.muted
  }

  // Soft tactile dot placement
  playDot() {
    if (this.muted) return
    this.init()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.08)

    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(now)
    osc.stop(now + 0.09)
  }

  // Crisp, sharp swoosh / slash cut sound when a line is cut
  playCut() {
    if (this.muted) return
    this.init()
    if (!this.ctx) return

    const now = this.ctx.currentTime

    // White noise buffer for blade swish
    const bufferSize = this.ctx.sampleRate * 0.18
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1400, now)
    filter.frequency.exponentialRampToValueAtTime(3200, now + 0.08)
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.18)
    filter.Q.value = 3.0

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.ctx.destination)

    noise.start(now)

    // Secondary high tone chime for rewarding score feeling
    const chime = this.ctx.createOscillator()
    const chimeGain = this.ctx.createGain()
    chime.type = 'triangle'
    chime.frequency.setValueAtTime(660, now + 0.03)
    chime.frequency.exponentialRampToValueAtTime(880, now + 0.12)
    chimeGain.gain.setValueAtTime(0.2, now + 0.03)
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

    chime.connect(chimeGain)
    chimeGain.connect(this.ctx.destination)
    chime.start(now + 0.03)
    chime.stop(now + 0.22)
  }

  // Match found celebration chime
  playMatchFound() {
    if (this.muted) return
    this.init()
    if (!this.ctx) return

    const notes = [440, 554.37, 659.25, 880]
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.08
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.2)
    })
  }

  // Victory fanfare
  playWin() {
    if (this.muted) return
    this.init()
    if (!this.ctx) return

    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.12
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(0.28, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.35)
    })
  }

  // Game over tone
  playOver() {
    if (this.muted) return
    this.init()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.25)

    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(now)
    osc.stop(now + 0.3)
  }
}

export const sounds = new SoundController()
