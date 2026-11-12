import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { BLOCK, isUnder, match, risk } from './rules'

const RUN = 'Run it'
// Off by default: `/bash-guard on` turns it on.
const isOn = atom({ plugin: 'bash-guard', key: 'isOn' } as const, false)
const USAGE = 'Usage: /bash-guard [on|off|exclude [dir]|include [dir]]'

// Excluded directories, kept between sessions: commands run there skip the questions.
const excluded = async ($: EngineInterface) => ((await $.store.get('excluded')) ?? []) as string[]

// An absolute path for `arg` (default: the session's directory), `~` and relative paths resolved.
const resolveDir = async ($: EngineInterface, arg: string) => {
  const cwd = await $.session.cwd()
  const home = (await $.env.get('HOME')) ?? ''
  const p = arg === '' ? cwd : arg.replace(/^~(?=\/|$)/, home)
  const abs = p.startsWith('/') ? p : `${cwd}/${p}`
  const out: string[] = []
  for (const part of abs.split('/')) part === '..' ? out.pop() : part && part !== '.' && out.push(part)
  return `/${out.join('/')}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'bash-guard',
      description: 'Turn the Bash guard on or off, or exclude a directory from its questions',
      argumentHint: '[on|off|exclude [dir]|include [dir]]',
    })
    return next(e)
  })

  on('command.run', { command: 'bash-guard' }, async ($, e) => {
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    if (verb === 'exclude' || verb === 'include') {
      const dir = await resolveDir($, rest.join(' '))
      const list = (await excluded($)).filter(d => d !== dir)
      await $.store.set('excluded', verb === 'exclude' ? [...list, dir] : list)
      return { text: verb === 'exclude' ? `bash-guard: no questions in ${dir} (hard blocks still apply).` : `bash-guard: ${dir} guarded again.` }
    }
    if (verb === 'on' || verb === 'off') await update($, isOn, () => verb === 'on')
    else if (verb !== '') return { text: USAGE }
    const list = await excluded($)
    const state = (await read($, isOn)) ? 'bash-guard is on.' : 'bash-guard is off: Bash commands run unchecked.'
    return { text: list.length ? `${state}\nExcluded: ${list.join(', ')}` : state }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const blocked = match(BLOCK, e.command)
    if (blocked) return { deny: `bash-guard: blocked (${blocked}). Ask the user to run it themselves if intended.` }

    const risky = risk(e.command)
    if (!risky) return next(e)
    const skip = await excluded($)
    if (skip.length && isUnder(await $.session.cwd(), skip)) return next(e)

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
