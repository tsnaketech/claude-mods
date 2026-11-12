import { expect, mock, test } from 'claude-code/testing'
import { PRINTS_SECRET, SECRET_FILE, mentionsSecret } from './rules'

test('secret paths', () => {
  for (const p of ['/a/.env', '/a/.env.local', '/home/u/.ssh/id_ed25519', '/x/server.pem', '/h/.aws/credentials', '/h/.kube/config'])
    expect(SECRET_FILE.test(p)).toBe(true)
  for (const p of ['/a/.env.example', '/a/env.ts', '/a/README.md', '/a/keyboard.ts', '/a/src/environment.ts'])
    expect(SECRET_FILE.test(p)).toBe(false)
})

test('bash', () => {
  expect(mentionsSecret('cat .env')).toBe(true)
  expect(mentionsSecret('source ./.env && npm start')).toBe(true)
  expect(mentionsSecret('cp .env.example .env.example.bak')).toBe(false)
  expect(PRINTS_SECRET.test('printenv')).toBe(true)
  expect(PRINTS_SECRET.test('echo $GITHUB_TOKEN')).toBe(true)
  expect(PRINTS_SECRET.test('env')).toBe(true)
  expect(PRINTS_SECRET.test('env NODE_ENV=test npm test')).toBe(false)
  expect(PRINTS_SECRET.test('echo hello')).toBe(false)
})

const turnOn = ($: Parameters<Parameters<typeof test>[1]>[0]) =>
  $.command.run({ command: 'secret-guard', args: 'on' } as Parameters<typeof $.command.run>[0])

test('off by default: nothing is checked until /secret-guard on', async ($, on) => {
  mock.store(on)
  let ran = 0
  on('tool.call', () => ((ran += 1), { result: {} }))
  await $.tool.call({ tool: 'Read', file_path: '/p/' + '.env' })
  expect(ran).toBe(1)
  await turnOn($)
  expect((await $.tool.call({ tool: 'Read', file_path: '/p/' + '.env' })).deny).toContain('secret')
  await $.command.run({ command: 'secret-guard', args: 'off' } as Parameters<typeof $.command.run>[0])
  await $.tool.call({ tool: 'Read', file_path: '/p/' + '.env' })
  expect(ran).toBe(2)
})

test('Bash mentioning a secret file asks, and runs only on yes', async ($, on) => {
  mock.store(on)
  let ran = 0
  let answer = 'Block it'
  on('tool.call', { tool: 'Bash' }, () => ((ran += 1), { result: {} }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => ({
    result: { questions: e.questions, answers: { [e.questions[0]!.question]: answer } },
  }))
  await turnOn($)
  expect((await $.tool.call({ tool: 'Bash', command: 'git commit -m "ignore apps/.env"' })).deny).toContain('refused')
  answer = 'Run it'
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "ignore apps/.env"' })
  expect(ran).toBe(1)
})

test('Read of .env is refused', async ($, on) => {
  mock.store(on)
  let ran = false
  on('tool.call', () => ((ran = true), { result: {} }))
  await turnOn($)
  const r = await $.tool.call({ tool: 'Read', file_path: '/p/.env' })
  expect(r.deny).toContain('secret')
  expect(ran).toBe(false)
})
