import type { Register } from 'claude-code'

// Turns shorter than this stay silent.
const MIN_SECONDS = 120

export const register: Register = on => {
  let startedAt = 0

  on('prompt.submit', async ($, e, next) => {
    startedAt = await $.clock.now()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const seconds = Math.round(((await $.clock.now()) - startedAt) / 1000)
    if (startedAt > 0 && seconds >= MIN_SECONDS) {
      const took = seconds >= 60 ? `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}` : `${seconds}s`
      void $.ui.notify(`Claude finished (${took})`, { title: 'Claude Code' })
    }
    return next(e)
  })
}
