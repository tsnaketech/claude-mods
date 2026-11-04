import { expect, test } from 'claude-code/testing'

import { isDraft } from './register'

test('/improve rewrites the prompt into the box', async ($, on) => {
  let filled = ''
  on('command.register', () => ({ value: { command: 'improve' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('model.complete', () => ({ value: { isAnswered: true, text: '  Goal: fix the login bug.\n', usage: {} } as never }))
  on('prompt.fill', (_, e) => ((filled = e.text), { isFilled: true } as never))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const r = await $.command.run({ command: 'improve', args: 'fix login' } as Parameters<typeof $.command.run>[0])
  expect(r.text).toContain('Improved prompt is in the box')
  expect(filled).toBe('Goal: fix the login bug.')
  const empty = await $.command.run({ command: 'improve', args: '  ' } as Parameters<typeof $.command.run>[0])
  expect(empty.text).toContain('empty')
})

test('the button is for real drafts only', () => {
  expect(isDraft('please fix the login page bug')).toBe(true)
  expect(isDraft('continue')).toBe(false)
  expect(isDraft('/where and a long enough tail')).toBe(false)
})
