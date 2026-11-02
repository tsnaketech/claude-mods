import type { Register } from 'claude-code'

import { BLOCK, CONFIRM, match } from './rules'

const RUN = 'Run it'

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const blocked = match(BLOCK, e.command)
    if (blocked) return { deny: `bash-guard: blocked (${blocked}). Ask the user to run it themselves if intended.` }

    const risky = match(CONFIRM, e.command)
    if (!risky) return next(e)

    const short = e.command.length > 120 ? `${e.command.slice(0, 120)}…` : e.command
    // Dismissed dialog or no one to ask (-p): refuse rather than run.
    const answer = await $.ui
      .ask(`bash-guard: risky command (${risky}). Run "${short}"?`, { header: 'Bash guard', options: [RUN, 'Block it'] })
      .catch(() => undefined)
    return answer === RUN ? next(e) : { deny: `bash-guard: the user refused this command (${risky}).` }
  }).catch(($, e, next) =>
    // Fail closed: a guard bug must not let a command through unchecked.
    next.called ? next(e) : { deny: 'bash-guard: its check failed, command not run.' },
  )
}
