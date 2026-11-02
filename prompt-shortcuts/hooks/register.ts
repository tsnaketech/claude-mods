import type { EngineInterface, Register } from 'claude-code'

import { fill, parse } from './shortcuts'
import type { Shortcut } from './shortcuts'

// Global file, then the project's own (same name: the project wins).
const load = async ($: EngineInterface, cwd: string) => {
  const byName = new Map<string, Shortcut>()
  const files = [`${$.plugin.root}/shortcuts.yaml`, `${cwd}/.claude/shortcuts.yaml`]
  for (const file of files) {
    if (!(await $.fs.exists(file))) continue
    try {
      for (const s of parse(await $.fs.read(file))) byName.set(s.name, s)
    } catch (err) {
      throw new Error(`${file}: ${err instanceof Error ? err.message : err}`)
    }
  }
  return byName
}

export const register: Register = on => {
  let cwd = '.'
  let names: string[] = []

  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    const ran = await next(e)
    try {
      const all = await load($, cwd)
      for (const s of all.values()) {
        await $.command
          .register({ name: s.name, description: s.description, argumentHint: '[details]' })
          .then(() => names.push(s.name))
          .catch(err => $.ui.toast(`prompt-shortcuts: /${s.name} not added: ${err}`))
      }
    } catch (err) {
      $.ui.toast(`prompt-shortcuts: ${err}`)
    }
    return ran
  })

  on('command.run', async ($, e, next) => {
    if (!names.includes(e.command)) return next(e)
    // Re-read so prompt edits apply without a restart.
    let s: Shortcut | undefined
    try {
      s = (await load($, cwd)).get(e.command)
    } catch (err) {
      return { text: `prompt-shortcuts: ${err}` }
    }
    if (!s) return { text: `prompt-shortcuts: /${e.command} is no longer in any shortcuts.yaml.` }
    const text = fill(s.prompt, e.args)
    // A command.run hook may not submit (it holds the turn): submit just after it returns.
    void $.clock
      .sleep(1)
      .then(() => $.prompt.submit({ text, asUser: true }))
      .catch(err => $.ui.log(`prompt-shortcuts: ${err}`))
    return {}
  })
}
