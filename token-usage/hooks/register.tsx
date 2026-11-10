import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Context, Limit, Limits, Sample, Samples } from '../types'

const limits = atom({ plugin: 'token-usage', key: 'limits' } as const, [] as Limits)
const context = atom({ plugin: 'token-usage', key: 'context' } as const, null as Context)

export const kTokens = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
const isHidden = atom({ plugin: 'token-usage', key: 'isHidden' } as const, false)
const samples = atom({ plugin: 'token-usage', key: 'samples' } as const, {} as Samples)

const record = async ($: EngineInterface, list: Limits) => {
  const t = await $.clock.now()
  await update($, samples, all => {
    const next = { ...all }
    for (const l of list) {
      const h = HORIZON[l.kind]
      if (h) next[l.kind] = addSample(all[l.kind] ?? [], { t, pct: l.percentUsed }, h)
    }
    return next
  })
}

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: 'Week' }

export const bar = (pct: number, width = 10) => {
  const full = Math.round((Math.min(100, Math.max(0, pct)) / 100) * width)
  return '█'.repeat(full) + '░'.repeat(width - full)
}

export const resetIn = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`
}

// How far back the burn rate looks, per window. Only these windows get a forecast (the weekly one has none).
const HORIZON: Record<string, number> = { five_hour: 60 * 60000 }
// Keep readings of the current window only, within its horizon.
export const addSample = (list: Sample[], s: Sample, horizon: number) => {
  const last = list[list.length - 1]
  const kept = last && s.pct < last.pct ? [] : list // the figure dropped: a new window began
  return [...kept, s].filter(one => s.t - one.t <= horizon)
}

// When the window will hit 100% at the current pace, if before it resets.
export const fullIn = (samples: Sample[], l: Limit, now: number) => {
  const first = samples[0]
  if (!first || l.percentUsed >= 100 || now - first.t < 5 * 60000) return undefined
  const perMs = (l.percentUsed - first.pct) / (now - first.t)
  if (perMs <= 0) return undefined
  const at = now + (100 - l.percentUsed) / perMs
  return l.resetsAt && at >= Date.parse(l.resetsAt) ? undefined : at
}

export const isStale = (l: Limit, now: number) => l.resetsAt !== undefined && Date.parse(l.resetsAt) <= now

const color = (pct: number) => (pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green')

// Ticks every minute so the reset countdown redraws between responses.
const tick = atom({ plugin: 'token-usage', key: 'tick' } as const, 0)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'token-usage',
      description: 'Show/hide 5-hour and weekly usage under the prompt (/token-usage refresh re-reads it)',
      argumentHint: '[refresh]',
    })
    const ran = await next(e)
    const usage = await $.session.usage()
    await update($, limits, () => usage.rateLimits)
    await update($, context, () => usage.context)
    await record($, usage.rateLimits)
    $.clock.every(60_000, () => void update($, tick, n => n + 1))
    return ran
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => e.rateLimits)
      await record($, e.rateLimits)
    }
    if (e.changed.includes('context')) await update($, context, () => e.context)
    return next(e)
  })

  on('command.run', { command: 'token-usage' }, async ($, e) => {
    if (e.args.trim() === 'refresh') {
      // Limits only arrive on an API response, so send the smallest one possible.
      const r = await $.model.complete({ model: 'haiku', prompt: '.', maxTokens: 1 })
      if (!r.isAnswered && r.reason === 'api-error') return { text: `Refresh failed: ${r.error}` }
      const { rateLimits } = await $.session.usage()
      await update($, limits, () => rateLimits)
      await record($, rateLimits)
      return { text: 'Usage refreshed.' }
    }
    const hidden = await update($, isHidden, v => !v)
    return { text: hidden ? 'Usage line hidden.' : 'Usage line shown.' }
  })

  // Draw both windows side by side, in color, on the hint line under the prompt.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (await read($, isHidden)) return next(e)
    await read($, tick)
    const known = (await read($, limits)).filter((l: Limit) => LABELS[l.kind])
    const now = await $.clock.now()
    const history = await read($, samples)
    const ctx = await read($, context)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row">
        {known.length === 0 && !ctx?.percent && <Text dimColor>Usage: waiting for the first response</Text>}
        {known.map((l: Limit, i: number) =>
          isStale(l, now) ? (
            // The window reset since the last response: its old figure no longer holds.
            <Text dimColor>
              {i > 0 ? '   │   ' : ''}
              {LABELS[l.kind]} reset — waiting for next response
            </Text>
          ) : (
            <Text>
              <Text dimColor>{i > 0 ? '   │   ' : ''}{LABELS[l.kind]} </Text>
              <Text color={color(l.percentUsed)}>{bar(l.percentUsed)} {l.percentUsed}%</Text>
              <Text dimColor>{l.resetsAt ? ` · resets in ${resetIn(l.resetsAt, now)}` : ''}</Text>
              {(at => (at === undefined ? null : <Text color="yellow">{` · full in ~${resetIn(new Date(at).toISOString(), now)}`}</Text>))(
                HORIZON[l.kind] ? fullIn(history[l.kind] ?? [], l, now) : undefined,
              )}
            </Text>
          ),
        )}
        {ctx?.percent !== undefined && (
          <Text>
            <Text dimColor>{known.length > 0 ? '   │   ' : ''}Ctx </Text>
            <Text color={color(ctx.percent)}>{bar(ctx.percent)} {ctx.percent}%</Text>
            <Text dimColor>{ctx.tokens !== undefined ? ` · ${kTokens(ctx.tokens)}/${kTokens(ctx.window)}` : ''}</Text>
          </Text>
        )}
        <Text dimColor>{'   '}{e.props.hint}</Text>
      </Box>
    )
  })
}
