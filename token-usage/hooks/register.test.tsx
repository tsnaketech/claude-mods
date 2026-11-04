import { expect, test } from 'claude-code/testing'
import { addSample, bar, fullIn, resetIn } from './register'

const HINT = {
  plugin: 'token-usage',
  component: 'PromptHint',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

test('helpers', () => {
  expect(bar(50)).toBe('█████░░░░░')
  expect(bar(150, 4)).toBe('████')
  expect(resetIn(new Date(90 * 60000).toISOString(), 0)).toBe('1h30')
  expect(resetIn(new Date((2 * 1440 + 180) * 60000).toISOString(), 0)).toBe('2d 3h')
})

test('both windows side by side under the prompt', async ($, on) => {
  on('command.register', () => ({ value: { command: 'token-usage' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: 0 }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200000, tokens: 76400, percent: 38 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 42, resetsAt: new Date(90 * 60000).toISOString() },
        { kind: 'seven_day', percentUsed: 91.5 },
      ],
    },
  }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...HINT, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /42%/ }))?.text).toBe('5h ████░░░░░░ 42% · resets in 1h30')
  expect((await ui.find({ type: 'Text', text: /91.5%/ }))?.text).toContain('Week █████████░ 91.5%')
  expect((await ui.find({ type: 'Text', text: /Ctx/ }))?.text).toBe('   │   Ctx ████░░░░░░ 38% · 76k/200k')
  expect((await ui.find({ type: 'Text', text: /shortcuts/ }))?.text).toContain('? for shortcuts')
  await ui.unmount()
})

test('/token-usage refresh pings the API then redraws the new figures', async ($, on) => {
  let pct = 10
  let pinged = 0
  on('command.register', () => ({ value: { command: 'token-usage' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: 0 }))
  on('model.complete', () => ((pinged += 1), (pct = 55), ({ value: { isAnswered: true, text: '.', usage: {} } as never })))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000 }, rateLimits: [{ kind: 'five_hour', percentUsed: pct }] },
  }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const r = await $.command.run({ command: 'token-usage', args: 'refresh' } as Parameters<typeof $.command.run>[0])
  expect(r.text).toBe('Usage refreshed.')
  expect(pinged).toBe(1)
  const ui = await $.ui.mount({ ...HINT, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /55%/ })).toBeDefined()
  await ui.unmount()
})

test('a window past its reset shows as waiting', async ($, on) => {
  on('command.register', () => ({ value: { command: 'token-usage' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: 10 * 60000 }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200000 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 97, resetsAt: new Date(5 * 60000).toISOString() },
        { kind: 'seven_day', percentUsed: 40, resetsAt: new Date(90 * 60000).toISOString() },
      ],
    },
  }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...HINT, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /5h/ }))?.text).toBe('5h reset — waiting for next response')
  expect(await ui.find({ type: 'Text', text: /97%/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /40%/ }))?.text).toContain('resets in 1h20')
  await ui.unmount()
})

test('forecast', () => {
  const m = 60000
  const l = (pct: number, resetMin?: number) => ({
    kind: 'five_hour', percentUsed: pct, resetsAt: resetMin === undefined ? undefined : new Date(resetMin * m).toISOString(),
  })
  // 20% -> 50% in 30 min: 1%/min, 50% left -> full 50 min after now (t=30).
  expect(fullIn([{ t: 0, pct: 20 }], l(50, 300), 30 * m)).toBe(80 * m)
  // Would fill after the reset: nothing shown.
  expect(fullIn([{ t: 0, pct: 20 }], l(50, 60), 30 * m)).toBeUndefined()
  // Flat, or too little history.
  expect(fullIn([{ t: 0, pct: 50 }], l(50, 300), 30 * m)).toBeUndefined()
  expect(fullIn([{ t: 0, pct: 20 }], l(50, 300), 2 * m)).toBeUndefined()
  // A drop starts a new window; old readings past the horizon leave.
  expect(addSample([{ t: 0, pct: 80 }], { t: m, pct: 5 }, 60 * m)).toEqual([{ t: m, pct: 5 }])
  expect(addSample([{ t: 0, pct: 1 }, { t: 50 * m, pct: 2 }], { t: 70 * m, pct: 3 }, 60 * m)).toEqual([
    { t: 50 * m, pct: 2 }, { t: 70 * m, pct: 3 },
  ])
})
