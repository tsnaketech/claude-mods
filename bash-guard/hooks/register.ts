import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { BLOCK, match, risk } from './rules'

const RUN = 'Run it'
const isOff = atom({ plugin: 'bash-guard', key: 'isOff' } as const, false)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'bash-guard',
      description: 'Turn the Bash guard on or off (/bash-guard on|off)',
      argumentHint: '[on|off]',
    })
    return next(e)
  })

  on('command.run', { command: 'bash-guard' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'on' || arg === 'off') await update($, isOff, () => arg === 'off')
    else if (arg !== '') return { text: 'Usage: /bash-guard [on|off]' }
    return { text: (await read($, isOff)) ? 'bash-guard is off: Bash commands run unchecked.' : 'bash-guard is on.' }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (await read($, isOff)) return next(e)
    const blocked = match(BLOCK, e.command)
    if (blocked) return { deny: `bash-guard: blocked (${blocked}). Ask the user to run it themselves if intended.` }

    const risky = risk(e.command)
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
