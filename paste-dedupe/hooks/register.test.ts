import { expect, test } from 'claude-code/testing'

const long = 'Please do the following long task. '.repeat(10)

test('a repeated long prompt asks; cancel drops it, short ones never ask', async ($, on) => {
  let asked = 0
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => (
    (asked += 1), { result: { questions: e.questions, answers: { [e.questions[0]!.question]: 'Cancel' } } }
  ))
  const send = (text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as never)
  expect((await send(long)).drop).toBeUndefined()
  expect((await send(long)).drop).toContain('Not sent')
  await send('continue')
  await send('continue')
  expect(asked).toBe(1)
})
