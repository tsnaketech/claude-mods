import type { Register } from 'claude-code'

import { PRINTS_SECRET, SECRET_FILE, mentionsSecret } from './rules'

const deny = (what: string) => ({
  deny: `secret-guard: ${what} is a secret file; access refused. Ask the user if it is really needed.`,
})

export const register: Register = on => {
  const failClosed = { deny: 'secret-guard: its check failed.' }
  on('tool.call', { tool: 'Read' }, ($, e, next) => (SECRET_FILE.test(e.file_path) ? deny(e.file_path) : next(e)))
    .catch(($, e, next) => (next.called ? next(e) : failClosed))
  on('tool.call', { tool: 'Edit' }, ($, e, next) => (SECRET_FILE.test(e.file_path) ? deny(e.file_path) : next(e)))
    .catch(($, e, next) => (next.called ? next(e) : failClosed))
  on('tool.call', { tool: 'Write' }, ($, e, next) => (SECRET_FILE.test(e.file_path) ? deny(e.file_path) : next(e)))
    .catch(($, e, next) => (next.called ? next(e) : failClosed))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (mentionsSecret(e.command)) return deny('a file in this command')
    if (!PRINTS_SECRET.test(e.command)) return next(e)
    const answer = await $.ui
      .ask(`secret-guard: this command may print secrets to the transcript. Run "${e.command.slice(0, 120)}"?`, {
        header: 'Secrets',
        options: ['Run it', 'Block it'],
      })
      .catch(() => undefined)
    return answer === 'Run it' ? next(e) : { deny: 'secret-guard: the user refused a command that may print secrets.' }
  }).catch(($, e, next) => (next.called ? next(e) : failClosed))
}
