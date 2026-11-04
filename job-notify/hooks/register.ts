import type { Register } from 'claude-code'

// "<status>completed</status> ... <summary>Background command "make" completed</summary>"
export const describe = (text: string) => {
  const status = /<status>([^<]+)<\/status>/.exec(text)?.[1]?.trim()
  const summary = /<summary>([^<]+)<\/summary>/.exec(text)?.[1]?.trim()
  return { status, summary: summary ?? 'A background task finished' }
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'task-notification') {
      const { status, summary } = describe(e.text)
      void $.ui.notify(summary, { title: status === 'completed' || !status ? 'Task done' : `Task ${status}` }).catch(() => undefined)
    }
    return next(e)
    // Fail open: a broken check must never lose the person's prompt.
  }).catch(($, e, next) => next(e))
}
