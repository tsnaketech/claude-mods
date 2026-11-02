import { expect, test } from 'claude-code/testing'
import { fill, parse } from './shortcuts'

test('fill', () => {
  expect(fill('Write tests for {args}, then run them.', 'src/a.ts')).toBe('Write tests for src/a.ts, then run them.')
  expect(fill('Review the changes {args}. Fix them.', '')).toBe('Review the changes. Fix them.')
})

test('parse', () => {
  const list = parse(`# c
a-b:
  description: "Desc"
  prompt: |
    Line one {args}
    Line two

c:
  prompt: >
    folded
    text
`)
  expect(list).toEqual([
    { name: 'a-b', description: 'Desc', prompt: 'Line one {args}\nLine two' },
    { name: 'c', description: 'folded text', prompt: 'folded text' },
  ])
  expect(() => parse('  orphan: x')).toThrow()
  expect(() => parse('x:\n  description: no prompt')).toThrow()
})

test('a shortcut submits its prompt', async ($, on) => {
  let sent = ''
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ((sent = e.text), { text: e.text }))
  on('ui.log', (_, e) => ((sent = 'LOG ' + JSON.stringify(e)), { value: undefined }))
  on('fs.exists', (_, e) => ({ value: e.path !== '//.claude/shortcuts.yaml' })) // no project file
  on('fs.read', () => ({ value: 'p-fix:\n  description: Fix\n  prompt: Find the root cause of this bug and fix it, then verify: {args}\n' }))
  on('clock.sleep', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'p-fix', args: 'login fails' } as Parameters<typeof $.command.run>[0])
  for (let i = 0; i < 20 && sent === ''; i++) await Promise.resolve()
  expect(sent).toBe('Find the root cause of this bug and fix it, then verify: login fails')
})

test('the project file adds and overrides shortcuts', async ($, on) => {
  const sent: string[] = []
  const registered: string[] = []
  on('command.register', (_, e) => (registered.push(e.name), { value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', (_, e) => ({
    value: e.path.startsWith('/proj/')
      ? 'p-fix:\n  prompt: Project fix {args}\ndeploy:\n  prompt: Deploy {args}\n'
      : 'p-fix:\n  prompt: Global fix {args}\np-tests:\n  prompt: Tests {args}\n',
  }))
  on('clock.sleep', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => (sent.push(e.text), { text: e.text }))
  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })
  expect(registered.sort()).toEqual(['deploy', 'p-fix', 'p-tests'])
  await $.command.run({ command: 'p-fix', args: 'x' } as Parameters<typeof $.command.run>[0])
  await $.command.run({ command: 'deploy', args: 'prod' } as Parameters<typeof $.command.run>[0])
  for (let i = 0; i < 40 && sent.length < 2; i++) await Promise.resolve()
  expect(sent).toEqual(['Project fix x', 'Deploy prod'])
})
