import { expect, test } from 'claude-code/testing'

import { describe } from './register'

test('reads status and summary from a task notification', () => {
  expect(describe('<task-notification><status>failed</status><summary>Background command "make" failed</summary></task-notification>')).toEqual({
    status: 'failed',
    summary: 'Background command "make" failed',
  })
  expect(describe('no tags').summary).toBe('A background task finished')
})

test('notifies on a task notification only', async ($, on) => {
  const sent: string[] = []
  on('ui.notify', (_, e) => (sent.push(e.text), { value: { isSent: true } as never }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  const note = '<status>completed</status><summary>Build done</summary>'
  await $.prompt.submit({ text: note, origin: { kind: 'task-notification' } } as never)
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' } } as never)
  expect(sent).toEqual(['Build done'])
})
