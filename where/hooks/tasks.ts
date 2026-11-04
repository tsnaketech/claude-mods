export type Task = { id: string; title: string; status: string }

const STATUSES = ['en cours', 'bloquée', 'à faire', 'terminée', 'in progress', 'blocked', 'todo', 'done']
const statusIn = (text: string) => STATUSES.find(s => text.toLowerCase().includes(s))

// Reads both TASKS.md layouts: `### T001 — Title` + `- Statut : x`, and table rows `| T104 | ... | en cours |`.
export const parseTasks = (md: string): Task[] => {
  const tasks: Task[] = []
  let open: Task | undefined
  for (const line of md.split('\n')) {
    const head = /^#{2,4}\s+(T\d+)\s*[—–-]\s*(.+)$/.exec(line)
    if (head) {
      open = { id: head[1]!, title: head[2]!.trim(), status: '' }
      tasks.push(open)
      continue
    }
    const st = /^\s*-\s*(Statut|Status)\s*:\s*(.+)$/i.exec(line)
    if (st && open && !open.status) {
      open.status = statusIn(st[2]!) ?? st[2]!.trim()
      continue
    }
    const row = /^\|\s*(T\d+)\s*\|([^|]*)\|(.*)\|\s*$/.exec(line)
    if (row) {
      const cells = row[3]!.split('|')
      tasks.push({ id: row[1]!, title: row[2]!.trim().slice(0, 80), status: statusIn(cells[cells.length - 1] ?? '') ?? '' })
      open = undefined
    }
  }
  // A template's example task ("T001 — Titre") is not work.
  return tasks.filter(t => t.title !== 'Titre')
}

export const summarize = (tasks: Task[]) => {
  const active = tasks.filter(t => /en cours|in progress|bloquée|blocked/.test(t.status))
  const next = tasks.filter(t => /à faire|todo/.test(t.status)).slice(0, 3)
  const done = tasks.filter(t => /terminée|done/.test(t.status)).length
  const backlog = tasks.filter(t => !t.status).length // rows of a table with no status column
  const line = (t: Task) => `  ${t.id} ${t.title} (${t.status})`
  return [
    `Tasks: ${done}/${tasks.length - backlog} done${backlog ? `, ${backlog} more in the backlog` : ''}`,
    ...(active.length ? ['In progress / blocked:', ...active.map(line)] : ['Nothing in progress.']),
    ...(next.length ? ['Next up:', ...next.map(line)] : []),
  ].join('\n')
}
