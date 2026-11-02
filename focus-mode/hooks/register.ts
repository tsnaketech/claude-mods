import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { FocusDir } from '../types'

const focus = atom({ plugin: 'focus-mode', key: 'dir' } as const, null as FocusDir)

// Absolute, with `.` and `..` folded, no trailing slash.
export const normalize = (path: string, cwd: string) => {
  const out: string[] = []
  for (const part of (path.startsWith('/') ? path : `${cwd}/${path}`).split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return `/${out.join('/')}`
}

export const isInside = (path: string, dir: string, cwd: string) => {
  const p = normalize(path, cwd)
  return dir === '/' || p === dir || p.startsWith(`${dir}/`)
}

export const register: Register = on => {
  let cwd = '/'

  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({
      name: 'focus-dir',
      description: 'Restrict edits to one folder (/focus-dir <dir>, /focus-dir off)',
      argumentHint: '[dir|off]',
    })
    return next(e)
  })

  on('command.run', { command: 'focus-dir' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === '') {
      const dir = await read($, focus)
      return { text: dir ? `Focus: edits limited to ${dir}` : 'Focus is off.' }
    }
    if (arg === 'off') {
      await update($, focus, () => null)
      $.ui.status(undefined)
      return { text: 'Focus off: edits allowed everywhere.' }
    }
    const dir = normalize(arg, cwd)
    await update($, focus, () => dir)
    $.ui.status(`focus: ${dir}`)
    return {
      text: `Focus on: edits limited to ${dir}`,
      context: [`The user restricted file edits to ${dir}. Do not modify files outside it.`],
    }
  })

  const refusal = (dir: string, path: string) => ({
    deny: `focus-mode: edits are limited to ${dir}; ${path} is outside. Ask the user or run /focus-dir off.`,
  })
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const dir = await read($, focus)
    return dir && !isInside(e.file_path, dir, cwd) ? refusal(dir, e.file_path) : next(e)
  })
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const dir = await read($, focus)
    return dir && !isInside(e.file_path, dir, cwd) ? refusal(dir, e.file_path) : next(e)
  })
}
