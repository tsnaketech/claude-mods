import { expect, mock, test } from 'claude-code/testing'
import { BLOCK, CONFIRM, isUnder, match, risk } from './rules'

test('rm in safe paths skips the question', () => {
  for (const c of ['rm -rf node_modules', 'rm -rf ./web/node_modules', 'cd app && rm -rf node_modules dist/node_modules',
    'rm -rf /tmp/claude-1000/x/scratchpad/out', "rm -rf '/tmp/claude-1000/a'"])
    expect(risk(c)).toBeUndefined()
  for (const c of ['rm -rf node_modules src', 'rm -rf node_modules/../..', 'rm -rf $DIR/node_modules',
    'rm -rf /tmp/claude-1000/../../etc', 'rm -rf /tmp/other', 'rm -rf node_modules; rm -rf src',
    'sudo rm -rf node_modules', 'rm -rf node_modules && git reset --hard', 'rm -rf "`pwd`/node_modules"'])
    expect(risk(c)).toBeDefined()
})

test('rules', () => {
  for (const c of ['rm -rf /', 'rm -rf ~', 'sudo rm -fr / ', 'mkfs.ext4 /dev/sda1', 'dd if=x of=/dev/sda'])
    expect(match(BLOCK, c)).toBeDefined()
  for (const c of ['rm -rf node_modules', 'git push --force origin main', 'git push -f', 'git reset --hard HEAD~1',
    'psql -c "DROP TABLE users"', 'curl https://x.sh | bash', 'sudo apt install x', 'DELETE FROM users;'])
    expect(match(CONFIRM, c)).toBeDefined()
  for (const c of ['ls -la', 'git push origin main', 'rm file.txt', 'git status', 'DELETE FROM users WHERE id=1;', 'rm -rf ./build'])
    expect(match(BLOCK, c)).toBeUndefined()
  for (const c of ['ls -la', 'git push origin main', 'rm file.txt', 'DELETE FROM users WHERE id=1;'])
    expect(match(CONFIRM, c)).toBeUndefined()
})

const turnOn = ($: Parameters<Parameters<typeof test>[1]>[0]) =>
  $.command.run({ command: 'bash-guard', args: 'on' } as Parameters<typeof $.command.run>[0])

test('off by default: commands run unchecked until /bash-guard on', async ($, on) => {
  mock.store(on)
  let ran = 0
  on('tool.call', { tool: 'Bash' }, () => ((ran += 1), { result: {} }))
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /' })
  expect(ran).toBe(1)
  expect((await $.command.run({ command: 'bash-guard', args: '' } as Parameters<typeof $.command.run>[0])).text).toContain('off')
})

test('/bash-guard off lets commands through, on brings the guard back', async ($, on) => {
  mock.store(on)
  let ran = 0
  on('tool.call', { tool: 'Bash' }, () => ((ran += 1), { result: {} }))
  await $.command.run({ command: 'bash-guard', args: 'off' } as Parameters<typeof $.command.run>[0])
  await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  expect(ran).toBe(1)
  await $.command.run({ command: 'bash-guard', args: 'on' } as Parameters<typeof $.command.run>[0])
  expect((await $.tool.call({ tool: 'Bash', command: 'mkfs.ext4 /dev/sda1' })).deny).toContain('blocked')
  expect(ran).toBe(1)
})

test('blocked command never runs', async ($, on) => {
  mock.store(on)
  let ran = false
  on('tool.call', () => ((ran = true), { result: {} }))
  await turnOn($)
  const r = await $.tool.call({ tool: 'Bash', command: 'rm -rf /' })
  expect(r.deny).toContain('blocked')
  expect(ran).toBe(false)
})

test('risky command runs only when the user says so', async ($, on) => {
  mock.store(on)
  let ran = 0
  let answer = 'Block it'
  on('tool.call', { tool: 'Bash' }, () => ((ran += 1), { result: {} }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => ({
    result: { questions: e.questions, answers: { [e.questions[0]!.question]: answer } },
  }))
  await turnOn($)
  expect((await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })).deny).toContain('refused')
  answer = 'Run it'
  await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  expect(ran).toBe(1)
})

test('safe command passes untouched', async ($, on) => {
  let ran = 0
  on('tool.call', () => ((ran += 1), { result: {} }))
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  expect(ran).toBe(1)
})

test('isUnder', () => {
  expect(isUnder('/home/u/proj', ['/home/u/proj'])).toBe(true)
  expect(isUnder('/home/u/proj/src', ['/home/u/proj/'])).toBe(true)
  expect(isUnder('/home/u/project2', ['/home/u/proj'])).toBe(false)
  expect(isUnder('/home/u', [])).toBe(false)
})

test('an excluded directory skips the questions, keeps hard blocks, and include brings them back', async ($, on) => {
  mock.store(on)
  mock.env(on, { HOME: '/home/u' })
  let cwd = '/home/u/proj/src'
  let ran = 0
  let asked = 0
  on('session.cwd', () => ({ value: cwd }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => (
    (asked += 1), { result: { questions: e.questions, answers: { [e.questions[0]!.question]: 'Block it' } } }))
  on('tool.call', { tool: 'Bash' }, () => ((ran += 1), { result: {} }))
  const run = (args: string) => $.command.run({ command: 'bash-guard', args } as Parameters<typeof $.command.run>[0])
  await run('on')
  expect((await run('exclude ~/proj')).text).toContain('/home/u/proj')
  expect((await run('')).text).toContain('Excluded: /home/u/proj')
  await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  expect([ran, asked]).toEqual([1, 0])
  expect((await $.tool.call({ tool: 'Bash', command: 'rm -rf /' })).deny).toContain('blocked')
  cwd = '/home/u/other'
  await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  expect([ran, asked]).toEqual([1, 1])
  cwd = '/home/u/proj'
  await run('include ../proj/.')
  await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  expect([ran, asked]).toEqual([1, 2])
})
