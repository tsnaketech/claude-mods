import type { Register } from 'claude-code'

// Below context-guard's 80% compaction prompt, so the handoff is written first.
const ASK_AT = 70
// Re-arm once the context dropped well below, e.g. after a compaction.
const REARM_BELOW = 50
const WRITE = 'Write HANDOFF.md'

export const HANDOFF_PROMPT =
  'The context is getting full. Use the claude-mem:handoff skill to write HANDOFF.md now (goal, current state, files touched, failed attempts, next steps), then stop.'

export const register: Register = on => {
  let asked = false

  on('session.measure', async ($, e, next) => {
    const pct = e.context.percent
    if (pct === undefined || !e.changed.includes('context')) return next(e)
    if (pct < REARM_BELOW) asked = false
    if (pct < ASK_AT || asked) return next(e)
    asked = true
    const answer = await $.ui
      .ask(`Context is ${pct}% full. Write a HANDOFF.md so a fresh session can pick up from here?`, {
        header: 'Handoff',
        options: [WRITE, 'Not now'],
      })
      .catch(() => undefined)
    // Submitting from inside the hook would hold the turn: queue it just after.
    if (answer === WRITE) void $.clock.sleep(1).then(() => $.prompt.submit({ text: HANDOFF_PROMPT }))
    return next(e)
  })
}
