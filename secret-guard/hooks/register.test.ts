import { expect, test } from 'claude-code/testing'
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

test('Read of .env is refused', async ($, on) => {
  let ran = false
  on('tool.call', () => ((ran = true), { result: {} }))
  const r = await $.tool.call({ tool: 'Read', file_path: '/p/.env' })
  expect(r.deny).toContain('secret')
  expect(ran).toBe(false)
})
