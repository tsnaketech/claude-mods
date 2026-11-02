# claude-mods

A marketplace of Claude Code mods (hooks modules). Each top-level folder is one independent mod; `.claude-plugin/marketplace.json` lists them all.

## Layout of a mod

```
<mod>/
  .claude-plugin/plugin.json   name, version, description, author, license (+ "types" when it keeps state)
  hooks/hooks.json             { "modules": ["./register.ts"] }  (.tsx when it draws UI)
  hooks/register.ts(x)         export const register: Register = on => { ... }
  hooks/*.test.ts(x)           tests, run by `claude plugin test <mod>`
  types/index.d.ts             only when the mod uses $.state: declares PluginState['<mod>']
```

`.claude-plugin/types/` inside a mod is written by the engine and git-ignored: never edit or commit it.

## Commands

- Validate: `claude plugin validate <mod>` (must end with "Validation passed")
- Test: `claude plugin test <mod>`
- Type-check: `tsc -p <mod>` once the engine has loaded the mod (it lays `.claude-plugin/types/`)

Run all three on every mod you change.

## Rules learned the hard way

- **No built-in command names.** `$.command.register` refuses them (`/focus` → the mod uses `/focus-dir`). Prefer prefixed names (`p-review`).
- **Guards fail closed.** A hook that refuses things ends with `.catch(($, e, next) => (next.called ? next(e) : { deny: '…' }))`, and a dismissed `$.ui.ask` counts as "no".
- **`$` is only passed to top-level functions** (a `function` or a `const` bound to one); the engine refuses `$` passed to a closure. Don't name a variable `on`.
- **No prompt submit from `command.run`**: it holds the turn. Defer it: `$.clock.sleep(1).then(() => $.prompt.submit(...))`.
- **`turn.step` is a streaming event**: `async function* ($, e, next) { return yield* next(e) }`.
- **Contracts are self-contained**: `types/index.d.ts` imports nothing and exports only types.
- **No dependencies.** Modules have no Node or DOM; everything outside goes through `$` (`$.fs`, `$.clock`, `$.ui`…). Small parsers are written in the mod (see `prompt-shortcuts/hooks/shortcuts.ts`).
- `$.audio.play` is silent on Linux and over SSH; notify through `$.ui.notify` instead.

## Adding a mod

1. Create `<mod>/` with the files above; keep it small and give it at least one test.
2. Add an entry to `.claude-plugin/marketplace.json` (`name`, `source: "./<mod>"`, `description`).
3. Add a row to the table in `README.md`.
4. Validate, test, type-check.

## Style

Code, comments, UI text and docs in English. Comment only the why. A shortcut with a known limit gets `// shortcut: <limit>, <when to upgrade>`.
