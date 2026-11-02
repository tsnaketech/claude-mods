import { expect, test } from 'claude-code/testing'

test('notifies on a block and on a question', async ($, on) => {
  const sent: string[] = []
  on('ui.notify', (_, e) => (sent.push(e.text), { value: { isSent: true, channel: 'terminal_bell' } }))
  on('tool.call', { tool: 'Bash' }, () => ({ deny: 'bash-guard: blocked' }))
  on('tool.call', { tool: 'Read' }, () => ({ result: {} }))
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: {} }))
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /' })
  await $.tool.call({ tool: 'Read', file_path: '/a' })
  await $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Ok?', header: 'x', options: [{ label: 'a', description: '' }, { label: 'b', description: '' }], multiSelect: false }] })
  expect(sent).toEqual(['Blocked Bash: bash-guard: blocked', 'A question is waiting for you'])
})
