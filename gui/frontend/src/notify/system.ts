/** Operating system notifications and a short sound. Every call fails silently. */

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Must run inside a click handler (browsers ignore requests made without a user gesture). */
export function askNotificationPermission(): void {
  try {
    if (supported() && Notification.permission === 'default') void Notification.requestPermission()
  } catch {
    /* not available (e.g. plain http on a network address) */
  }
}

export function showSystemNotification(
  title: string,
  body: string,
  tag: string,
  onClick: () => void,
) {
  try {
    if (!supported() || Notification.permission !== 'granted') return
    const n = new Notification(title, { body, tag, requireInteraction: true })
    n.onclick = () => {
      window.focus()
      onClick()
      n.close()
    }
  } catch {
    /* ignore */
  }
}

let audio: AudioContext | null = null

/** Two soft tones (rising = good news, falling = error). */
export function playChime(good: boolean): void {
  try {
    const Ctor = window.AudioContext
    if (!Ctor) return
    audio ??= new Ctor()
    const ctx = audio
    const notes = good ? [660, 880] : [440, 330]
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.22
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.42)
    })
  } catch {
    /* no audio */
  }
}
