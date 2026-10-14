// Короткий сигнал без звуковых файлов. AudioContext создаём по нажатию «Старт»:
// браузеры разрешают звук только после действия пользователя.

let ctx: AudioContext | null = null

export function unlockSound() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* звук недоступен — ничего страшного */
  }
}

export function chime() {
  if (!ctx) return
  try {
    const now = ctx.currentTime
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + i * 0.25)
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.25 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.25 + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.25)
      osc.stop(now + i * 0.25 + 0.55)
    }
  } catch {
    /* ignore */
  }
}

export function notify(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible')
      new Notification(title, { body })
  } catch {
    /* на iPhone уведомления работают только у установленного приложения */
  }
}
