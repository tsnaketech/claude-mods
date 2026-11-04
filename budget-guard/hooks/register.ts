import type { Register } from 'claude-code'

// Ask before spawning subagents past this share of the 5-hour window.
const ASK_AT = 80
const GO = 'Spawn anyway'

export const register: Register = on => {
  // Once the person says go, stay quiet until that window resets.
  let allowedUntil = 0

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const { rateLimits } = await $.session.usage()
    const five = rateLimits.find(l => l.kind === 'five_hour')
    const now = await $.clock.now()
    if (!five || five.percentUsed < ASK_AT || now < allowedUntil) return next(e)

    const answer = await $.ui
      .ask(`budget-guard: the 5-hour window is at ${five.percentUsed}%. Spawn a subagent now?`, {
        header: 'Budget',
        options: [GO, 'Wait for the reset'],
      })
      .catch(() => undefined)
    if (answer !== GO) return { deny: `budget-guard: the user chose to wait; the 5-hour window is at ${five.percentUsed}%. Do the work inline or stop here.` }
    allowedUntil = five.resetsAt ? Date.parse(five.resetsAt) : now + 60 * 60000
    return next(e)
    // Fail open: a budget check must not block work because it broke.
  }).catch(($, e, next) => next(e))
}
