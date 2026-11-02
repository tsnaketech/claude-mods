import type { Register } from 'claude-code'

const WARN_AT = 80
// Re-arm once the context dropped well below, e.g. after a compaction.
const REARM_BELOW = 60

export const register: Register = on => {
  let warned = false

  on('session.measure', async ($, e, next) => {
    const pct = e.context.percent
    if (pct === undefined || !e.changed.includes('context')) return next(e)
    if (pct < REARM_BELOW) warned = false
    if (pct < WARN_AT || warned) return next(e)
    warned = true
    const answer = await $.ui
      .ask(`Context is ${pct}% full; responses will get slower and costlier. Compact now?`, {
        header: 'Context',
        options: ['Compact now', 'Later'],
      })
      .catch(() => undefined)
    if (answer === 'Compact now') void $.session.compact().catch(() => $.ui.toast('Compaction failed; run /compact.'))
    return next(e)
  })
}
