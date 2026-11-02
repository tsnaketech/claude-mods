import { expect, test } from 'claude-code/testing'

const at = (percent: number) => ({
  context: { window: 200000, percent },
  rateLimits: [],
  changed: ['context' as const],
})

test('asks once past 80%, compacts on yes, re-arms after a drop', async ($, on) => {
  let asked = 0
  let compacted = 0
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => (
    (asked += 1), { result: { questions: e.questions, answers: { [e.questions[0]!.question]: 'Compact now' } } }
  ))
  on('session.compact', () => ((compacted += 1), { messages: [{ role: 'user', text: 'summary', toolUses: [] }] } as never))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(at(50))
  await $.session.measure(at(85))
  await $.session.measure(at(90))
  expect(asked).toBe(1)
  expect(compacted).toBe(1)
  await $.session.measure(at(20))
  await $.session.measure(at(82))
  expect(asked).toBe(2)
})
