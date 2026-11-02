import type { Register } from 'claude-code'

// Rings through your notification channel (terminal bell, desktop notification...).
export const register: Register = on => {
  on('tool.call', async ($, e, next) => {
    // Covers Claude's questions and the guards' confirmations, which use the same dialog.
    if (e.tool === 'AskUserQuestion') void $.ui.notify('A question is waiting for you', { title: 'Claude Code' }).catch(() => {})
    const ran = await next(e)
    if (ran.deny !== undefined && e.tool !== 'AskUserQuestion') {
      void $.ui.notify(`Blocked ${e.tool}: ${ran.deny.slice(0, 100)}`, { title: 'Claude Code' }).catch(() => {})
    }
    return ran
  })
}
