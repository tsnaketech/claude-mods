import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { PRINTS_SECRET, SECRET_FILE, mentionsSecret } from './rules'

// Off by default: `/secret-guard on` turns it on.
const isOn = atom({ plugin: 'secret-guard', key: 'isOn' } as const, false)

const deny = (what: string) => ({
  deny: `secret-guard: ${what} is a secret file; access refused. Ask the user if it is really needed.`,
})

export const register: Register = on => {
  const failClosed = { deny: 'secret-guard: its check failed.' }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'secret-guard', description: 'Turn the secret guard on or off', argumentHint: '[on|off]' })
    return next(e)
  })

  on('command.run', { command: 'secret-guard' }, async ($, e) => {
    const verb = e.args.trim()
    if (verb === 'on' || verb === 'off') await update($, isOn, () => verb === 'on')
    else if (verb !== '') return { text: 'Usage: /secret-guard [on|off]' }
    return { text: (await read($, isOn)) ? 'secret-guard is on.' : 'secret-guard is off: secret files are not protected.' }
  })

  for (const tool of ['Read', 'Edit', 'Write'] as const)
    on('tool.call', { tool }, async ($, e, next) =>
      (await read($, isOn)) && SECRET_FILE.test(e.file_path) ? deny(e.file_path) : next(e),
    ).catch(($, e, next) => (next.called ? next(e) : failClosed))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const why = mentionsSecret(e.command)
      ? 'mentions a secret file'
      : PRINTS_SECRET.test(e.command) ? 'may print secrets to the transcript' : undefined
    if (!why) return next(e)
    // Ask rather than deny: the word scan also hits commit messages, grep patterns and existence tests.
    const answer = await $.ui
      .ask(`secret-guard: this command ${why}. Run "${e.command.slice(0, 120)}"?`, {
        header: 'Secrets',
        options: ['Run it', 'Block it'],
      })
      .catch(() => undefined)
    return answer === 'Run it' ? next(e) : { deny: `secret-guard: the user refused a command that ${why}.` }
  }).catch(($, e, next) => (next.called ? next(e) : failClosed))
}
