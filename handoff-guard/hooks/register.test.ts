import { expect, test } from 'claude-code/testing'

test('asks once past 70%, then re-arms after the context drops', async ($, on) => {
  let asked = 0
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => (
    (asked += 1), { result: { questions: e.questions, answers: { [e.questions[0]!.question]: 'Not now' } } }
  ))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  const measure = (percent: number) =>
    $.session.measure({ context: { window: 200000, percent }, rateLimits: [], changed: ['context'] } as never)
  await measure(60)
  await measure(72)
  await measure(75)
  expect(asked).toBe(1)
  await measure(30)
  await measure(71)
  expect(asked).toBe(2)
})
