import { expect, test } from 'claude-code/testing'

import { parseTasks, summarize } from './tasks'

test('reads both TASKS.md layouts', () => {
  const headings = [
    '### T001 — Analyse',
    '- Statut : terminée',
    '### T002 — Monorepo',
    '- Statut : en cours',
    '### T003 — Schémas',
    '- Statut : à faire',
    '### T001 — Titre',
    '- Statut : à faire',
  ].join('\n')
  expect(parseTasks(headings)).toEqual([
    { id: 'T001', title: 'Analyse', status: 'terminée' },
    { id: 'T002', title: 'Monorepo', status: 'en cours' },
    { id: 'T003', title: 'Schémas', status: 'à faire' },
  ])
  const table = ['| ID | Travail | Exigences | Statut / preuve |', '| T104 | QA visuelle | F12 | en cours — 3 rendus |', '| T105 | Voix | F13 | bloquée |'].join('\n')
  expect(parseTasks(table).map(t => t.status)).toEqual(['en cours', 'bloquée'])
  const text = summarize(parseTasks(headings))
  expect(text).toContain('Tasks: 1/3 done')
  expect(text).toContain('T002 Monorepo (en cours)')
  expect(text).toContain('Next up:')
})

test('/where answers from the files and git, without the model', async ($, on) => {
  on('command.register', () => ({ value: { command: 'where' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: '### T002 — Monorepo\n- Statut : en cours\n' }))
  on('process.run', (_, e) => ({
    value: { exitCode: 0, stdout: e.argv.includes('--show-current') ? 'main' : e.argv.includes('--porcelain') ? ' M a.ts\n' : e.argv.includes('--count') ? '2' : '  abc fix (2 hours ago)', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const r = await $.command.run({ command: 'where', args: '' } as Parameters<typeof $.command.run>[0])
  expect(r.text).toContain('T002 Monorepo (en cours)')
  expect(r.text).toContain('Git: main, 1 changed file(s), 2 commit(s) not pushed')
  expect(r.text).toContain('abc fix')
})
