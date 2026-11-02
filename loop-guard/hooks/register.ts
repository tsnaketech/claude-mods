import type { Register } from 'claude-code'

// The same Bash command failing this many times in a row is a loop.
const MAX_FAILS = 3
// The same file edited this many times in one turn is a loop.
const MAX_EDITS = 6

const stop = (why: string) => ({
  deny: `loop-guard: ${why}. Stop retrying: explain to the user what is going wrong and ask how to proceed.`,
})

export const register: Register = on => {
  let fails = new Map<string, number>()
  let edits = new Map<string, number>()

  // Each prompt from the user starts fresh.
  on('prompt.submit', ($, e, next) => {
    fails = new Map()
    edits = new Map()
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const key = e.command.trim()
    if ((fails.get(key) ?? 0) >= MAX_FAILS) {
      $.ui.toast(`loop-guard: stopped a command that failed ${MAX_FAILS} times`)
      return stop(`this exact command already failed ${MAX_FAILS} times`)
    }
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError === true) fails.set(key, (fails.get(key) ?? 0) + 1)
    else fails.delete(key)
    return ran
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const n = (edits.get(e.file_path) ?? 0) + 1
    if (n > MAX_EDITS) {
      $.ui.toast(`loop-guard: stopped edit #${n} of ${e.file_path}`)
      return stop(`${e.file_path} was already edited ${MAX_EDITS} times for this request`)
    }
    edits.set(e.file_path, n)
    return next(e)
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const n = (edits.get(e.file_path) ?? 0) + 1
    if (n > MAX_EDITS) {
      $.ui.toast(`loop-guard: stopped write #${n} of ${e.file_path}`)
      return stop(`${e.file_path} was already rewritten ${MAX_EDITS} times for this request`)
    }
    edits.set(e.file_path, n)
    return next(e)
  })
}
