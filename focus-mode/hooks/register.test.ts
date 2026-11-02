import { expect, test } from 'claude-code/testing'
import { isInside, normalize } from './register'

test('paths', () => {
  expect(normalize('src/api/', '/p')).toBe('/p/src/api')
  expect(isInside('/p/src/api/x.ts', '/p/src/api', '/p')).toBe(true)
  expect(isInside('/p/src/apiold/x.ts', '/p/src/api', '/p')).toBe(false)
  expect(isInside('/p/src/api/../web/x.ts', '/p/src/api', '/p')).toBe(false)
})

test('edit outside the focus is refused', async ($, on) => {
  let ran = 0
  on('command.register', () => ({ value: { command: 'focus-dir' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ((ran += 1), { result: {} }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'focus-dir', args: 'src/api' } as Parameters<typeof $.command.run>[0])
  expect((await $.tool.call({ tool: 'Write', file_path: '/p/web/a.ts', content: '' })).deny).toContain('focus-mode')
  await $.tool.call({ tool: 'Write', file_path: '/p/src/api/a.ts', content: '' })
  expect(ran).toBe(1)
})
