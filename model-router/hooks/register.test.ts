import { expect, test } from 'claude-code/testing'
import { isLight } from './register'

test('isLight', () => {
  for (const t of ['que fait cette fonction ?', 'What does parse() return?', 'pourquoi la barre est jaune ?', 'comment marche le mod focus'])
    expect(isLight(t)).toBe(true)
  for (const t of ['ajoute le 2 et le 5', 'fix the login bug', 'peux-tu corriger ce test ?', 'refactor this?', '/p-fix x', 'ok', 'x'.repeat(250) + '?'])
    expect(isLight(t)).toBe(false)
})

test('a light turn runs on the lighter model, a heavy one untouched', async ($, on) => {
  const models: string[] = []
  on('ui.toast', () => ({ value: undefined }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ turnId: e.turnId }) as never)
  on('turn.step', async function* (_, e) {
    models.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [] } as never
  })
  await $.turn.start({ text: 'que fait parse ?', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'opus' } as never)) void _
  await $.turn.start({ text: 'ajoute un test', turnId: 't2' })
  for await (const _ of $.turn.step({ turnId: 't2', index: 0, model: 'opus' } as never)) void _
  expect(models).toEqual(['sonnet', 'opus'])
})
