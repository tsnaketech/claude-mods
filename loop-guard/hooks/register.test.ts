import { expect, test } from 'claude-code/testing'

test('a command failing 3 times is stopped, until the next prompt', async ($, on) => {
  let ran = 0
  on('tool.call', { tool: 'Bash' }, () => ((ran += 1), { result: {}, isError: true }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.toast', () => ({ value: undefined }))
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect((await $.tool.call({ tool: 'Bash', command: 'npm test' })).deny).toContain('loop-guard')
  expect(ran).toBe(3)
  await $.tool.call({ tool: 'Bash', command: 'npm run build' })
  expect(ran).toBe(4)
  await $.prompt.submit({ text: 'try again' } as Parameters<typeof $.prompt.submit>[0])
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(ran).toBe(5)
})

test('a success resets the count', async ($, on) => {
  let n = 0
  on('tool.call', { tool: 'Bash' }, () => ((n += 1), n === 3 ? { result: {} } : { result: {}, isError: true }))
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Bash', command: 'make' })
  expect(n).toBe(5)
})

test('the 7th edit of one file is stopped', async ($, on) => {
  let ran = 0
  on('tool.call', { tool: 'Edit' }, () => ((ran += 1), { result: {} }))
  on('ui.toast', () => ({ value: undefined }))
  const edit = { tool: 'Edit' as const, file_path: '/a.ts', old_string: 'a', new_string: 'b' }
  for (let i = 0; i < 6; i++) await $.tool.call(edit)
  expect((await $.tool.call(edit)).deny).toContain('loop-guard')
  expect(ran).toBe(6)
})
