import type { Register } from 'claude-code'

// Short prompts ("continue", "oui") are meant to repeat.
const MIN_LENGTH = 200
const SEND = 'Send it again'

export const register: Register = on => {
  let last = ''

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer' || e.command || e.text.length < MIN_LENGTH) return next(e)
    const isRepeat = e.text.trim() === last
    last = e.text.trim()
    if (!isRepeat) return next(e)
    const answer = await $.ui
      .ask('paste-dedupe: this is the same prompt you sent last time. Send it again?', {
        header: 'Duplicate',
        options: [SEND, 'Cancel'],
      })
      .catch(() => SEND) // nobody to ask: never lose a prompt
    return answer === SEND ? next(e) : { drop: 'Not sent: same prompt as the previous one.' }
    // Fail open: a broken check must never lose the person's prompt.
  }).catch(($, e, next) => next(e))
}
