export type Shortcut = { name: string; description: string; prompt: string }

const unquote = (v: string) => {
  const t = v.trim()
  return /^(['"]).*\1$/.test(t) ? t.slice(1, -1) : t
}

// shortcut: reads only the shape shortcuts.yaml uses (top-level keys, two-space fields,
// plain/quoted values, `|` and `>` blocks); swap for a real YAML parser if the file grows richer.
export const parse = (text: string): Shortcut[] => {
  const out: Shortcut[] = []
  const lines = text.split(/\r?\n/)
  let cur: Record<string, string> | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (/^\s*(#|$)/.test(line)) continue
    const top = /^([\w-]+):\s*$/.exec(line)
    if (top) {
      cur = { name: top[1]! }
      out.push(cur as Shortcut)
      continue
    }
    const field = /^\s+(\w+):\s*(.*)$/.exec(line)
    if (!field || !cur) throw new Error(`line ${i + 1}: expected "name:" or "  field: value"`)
    const [, key, raw] = field as unknown as [string, string, string]
    if (raw === '|' || raw === '>') {
      const block: string[] = []
      while (i + 1 < lines.length && (/^\s{4,}/.test(lines[i + 1]!) || lines[i + 1]!.trim() === '')) {
        block.push(lines[++i]!.trim())
      }
      cur[key] = (raw === '|' ? block.join('\n') : block.join(' ')).trim()
    } else {
      cur[key] = unquote(raw)
    }
  }
  for (const s of out) {
    if (!s.prompt) throw new Error(`${s.name}: missing "prompt"`)
    s.description ??= s.prompt.slice(0, 60)
  }
  return out
}

export const fill = (template: string, args: string) =>
  template.replace(/\s*\{args\}/g, args.trim() === '' ? '' : ` ${args.trim()}`).trim()
