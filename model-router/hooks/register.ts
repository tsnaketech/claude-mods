import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { RouterOn } from '../types'

// The model light turns go to.
const LIGHT = 'sonnet'
const isOn = atom({ plugin: 'model-router', key: 'isOn' } as const, true as RouterOn)

const ACTION = /\b(fix|implement|add|create|write|build|refactor|rewrite|migrate|debug|change|update|remove|delete|rename|test|deploy|install|corrige|ajoute|crée|cree|écris|ecris|modifie|supprime|implémente|implemente|refactorise|développe|developpe|mets? en place|répare|repare|lance)\b/i
const QUESTION = /\?\s*$|^(what|why|how|where|when|which|who|is|are|does|do|can|explain|que|quoi|pourquoi|comment|où|ou est|quand|quel|quelle|quels|est-ce|explique|c'est quoi|qu'est-ce)\b/i

// A short question that asks for no change: cheap to answer.
export const isLight = (text: string) => {
  const t = text.trim()
  return t.length > 0 && t.length <= 200 && !t.includes('\n') && !t.startsWith('/') && QUESTION.test(t) && !ACTION.test(t)
}

export const register: Register = on => {
  const light = new Set<string>()

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'model-router',
      description: `Toggle sending short questions to ${LIGHT}`,
    })
    return next(e)
  })

  on('command.run', { command: 'model-router' }, async $ => {
    const enabled = await update($, isOn, v => !v)
    return { text: enabled ? `Model router on: short questions go to ${LIGHT}.` : 'Model router off.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && (await read($, isOn)) && isLight(e.text)) light.add(e.turnId)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (!light.has(e.turnId)) return yield* next(e)
    if (e.index === 0) $.ui.toast(`model-router: answering with ${LIGHT}`)
    return yield* next({ ...e, model: LIGHT })
  })

  on('turn.complete', ($, e, next) => {
    light.delete(e.turnId)
    return next(e)
  })
}
