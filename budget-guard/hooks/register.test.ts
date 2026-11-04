import { expect, test } from 'claude-code/testing'

const usage = (pct: number) => ({
  value: { startedAt: 0, context: { window: 200000 }, rateLimits: [{ kind: 'five_hour', percentUsed: pct, resetsAt: new Date(3600000).toISOString() }] },
})

test('under the threshold, the subagent spawns without a question', async ($, on) => {
  let ran = 0
  on('session.usage', () => usage(50))
  on('clock.now', () => ({ value: 0 }))
  on('tool.call', { tool: 'Agent' }, () => ((ran += 1), { result: {} }))
  await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'y' } as never)
  expect(ran).toBe(1)
})

test('past the threshold it asks; wait denies, go allows until the reset', async ($, on) => {
  let ran = 0
  let asked = 0
  let answer = 'Wait for the reset'
  on('session.usage', () => usage(85))
  on('clock.now', () => ({ value: 0 }))
  on('tool.call', { tool: 'Agent' }, () => ((ran += 1), { result: {} }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => (
    (asked += 1), { result: { questions: e.questions, answers: { [e.questions[0]!.question]: answer } } }
  ))
  expect((await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'y' } as never)).deny).toContain('wait')
  answer = 'Spawn anyway'
  await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'y' } as never)
  await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'y' } as never)
  expect(ran).toBe(2)
  expect(asked).toBe(2)
})
