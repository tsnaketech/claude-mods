import type { EngineInterface, Register } from 'claude-code'

import { parseTasks, summarize } from './tasks'

const git = async ($: EngineInterface, cwd: string, args: string[]) => {
  const r = await $.process.run(['git', ...args], { cwd, timeoutMs: 5000 }).catch(() => undefined)
  return r && r.exitCode === 0 ? r.stdout.trim() : undefined
}

export const register: Register = on => {
  let cwd = '.'

  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({ name: 'where', description: 'Where are we? Tasks in progress and the git state (no tokens spent)' })
    return next(e)
  })

  on('command.run', { command: 'where' }, async $ => {
    const parts: string[] = []
    const file = `${cwd}/docs/TASKS.md`
    parts.push((await $.fs.exists(file)) ? summarize(parseTasks(await $.fs.read(file))) : 'No docs/TASKS.md here.')

    const branch = await git($, cwd, ['branch', '--show-current'])
    if (branch !== undefined) {
      const dirty = (await git($, cwd, ['status', '--porcelain']))?.split('\n').filter(Boolean).length ?? 0
      const ahead = await git($, cwd, ['rev-list', '--count', '@{u}..HEAD'])
      const log = (await git($, cwd, ['log', '-3', '--format=%h %s (%cr)']))?.replace(/^/gm, '  ')
      parts.push(
        `Git: ${branch || '(detached)'}, ${dirty} changed file(s)${ahead && ahead !== '0' ? `, ${ahead} commit(s) not pushed` : ''}`,
        ...(log ? ['Last commits:', log] : []),
      )
    }
    return { text: parts.join('\n\n') }
  })
}
