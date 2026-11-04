import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Phase } from '../types'

// The button shows once the draft is at least this long.
const MIN_DRAFT = 20

// A real draft, not a slash command: the button only shows for one.
export const isDraft = (text: string) => text.trim().length >= MIN_DRAFT && !text.startsWith('/')

const hasDraft = atom({ plugin: 'prompt-improve', key: 'hasDraft' } as const, false)
const phase = atom({ plugin: 'prompt-improve', key: 'phase' } as const, 'idle' as Phase)

export const SYSTEM = `You rewrite a draft prompt that a developer is about to send to Claude Code, a coding agent working in their repository.
Make it clear and actionable: state the goal first, then the useful context, constraints and what "done" means, as short lines or bullets when that helps.
Keep the draft's language (French stays French), every fact, path, name and requirement it gives, and its intent. Invent nothing, add no requirement it does not imply, and stay about as short as the task needs.
Answer with the rewritten prompt only: no preamble, no quotes, no commentary.`

// Rewrites `draft` and puts the result in the prompt box; the person reviews it before sending.
const improve = async ($: EngineInterface, draft: string) => {
  if (draft.trim().length === 0) return 'Nothing to improve: the prompt box is empty.'
  await update($, phase, () => 'busy')
  try {
    const r = await $.model.complete({ model: 'sonnet', system: SYSTEM, prompt: draft, maxTokens: 2000, timeoutMs: 60000 })
    if (!r.isAnswered || !r.text.trim()) return `Prompt not improved (${r.isAnswered ? 'empty reply' : r.reason}).`
    await $.prompt.fill({ text: r.text.trim(), mode: 'replace' })
    return 'Improved prompt is in the box: review it, then press Enter.'
  } finally {
    await update($, phase, () => 'idle')
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'improve',
      description: 'Rewrite a prompt into a clearer one and put it in the prompt box (/improve <your prompt>)',
      argumentHint: '<prompt>',
    })
    return next(e)
  })

  on('command.run', { command: 'improve' }, async ($, e) => ({ text: await improve($, e.args) }))

  // Track only whether a draft is there, so the band redraws when the button appears, not on every key.
  on('prompt.change', async ($, e, next) => {
    const long = isDraft(e.text)
    if (long !== (await read($, hasDraft))) await update($, hasDraft, () => long)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const busy = (await read($, phase)) === 'busy'
    if (e.props.hasSurvey || !(busy || (await read($, hasDraft)))) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        {busy ? (
          <Text dimColor>✨ Improving your prompt…</Text>
        ) : (
          <Button
            key="improve"
            hotkey="i"
            label="✨ Improve prompt"
            onPress={async () => {
              const msg = await improve($, (await $.prompt.read()).text)
              if (!msg.startsWith('Improved')) $.ui.toast(msg)
            }}
          />
        )}
      </Box>
    )
  })
}
