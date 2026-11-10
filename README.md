# claude-mods

Mods for [Claude Code](https://claude.com/claude-code): small hooks modules that add a usage bar, safety guards, shortcuts and notifications to your sessions. Each mod is independent — install only the ones you want.

## Mods

| Mod | What it does |
| --- | --- |
| **token-usage** | Shows 5-hour and weekly usage under the prompt, side by side, in color (green / yellow ≥ 70% / red ≥ 90%), with the time until reset and, for the 5-hour window only, a forecast (`full in ~45m`) when your pace would hit the limit first, then the context fill (`Ctx ████░░ 38% · 76k/200k`). `/token-usage` shows or hides it; `/token-usage refresh` re-reads it now (one 1-token Haiku call). |
| **bash-guard** | Refuses destructive Bash commands (`rm -rf /`, `mkfs`, `dd` to a disk, fork bombs) and asks before risky ones (`rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `curl … \| sh`, `sudo`…). `rm -rf` inside `node_modules` or Claude's `/tmp/claude-<uid>/` runs without asking (`SAFE_RM`). `/bash-guard off` turns it off, `/bash-guard on` back. Rules live in `bash-guard/hooks/rules.ts`. |
| **secret-guard** | Refuses reading or writing secret files (`.env`, SSH keys, `*.pem`, `~/.aws/`, `~/.kube/config`…; `.env.example` stays allowed) and asks before commands that may print secrets (`printenv`, `echo $…_TOKEN`). |
| **focus-mode** | `/focus-dir src/api` limits Claude's file edits to one folder; `/focus-dir off` lifts it. |
| **loop-guard** | Stops Claude when the same Bash command fails 3 times in a row, or one file is edited more than 6 times for one request, and asks it to explain instead of retrying. |
| **context-guard** | When the context passes 80%, asks whether to compact now. |
| **model-router** | Sends short questions that ask for no change to a lighter model (Sonnet) to save quota. `/model-router` toggles it. |
| **prompt-shortcuts** | Slash commands for prompts you type often, defined in YAML (`/p-review`, `/p-tests`, `/p-explain`, `/p-fix`). A project can add its own in `<project>/.claude/shortcuts.yaml`. |
| **turn-notify** | Desktop notification when a turn takes longer than 2 minutes. |
| **sound-events** | Notifies you (terminal bell or desktop notification, per your notification setting) when a question waits for you or an action is blocked. |
| **budget-guard** | Asks before spawning subagents when the 5-hour window is above 80%; once you say go, quiet until that window resets. |
| **handoff-guard** | At 70% context, offers to write a `HANDOFF.md` (via `claude-mem:handoff`) before the session gets summarized. |
| **where** | `/where`: tasks in progress and next up from `docs/TASKS.md`, branch, changed files, unpushed commits, last commits. No tokens spent. |
| **job-notify** | Desktop notification when a background task (build, render) finishes or fails. |
| **paste-dedupe** | Asks before sending the same long prompt (200+ characters) twice in a row. |
| **prompt-improve** | A `✨ Improve prompt` button above the prompt once you type a draft (click it, or ctrl+x tab then `i`), and `/improve <prompt>`: Sonnet rewrites the draft in the box for you to review before sending. |

## Install

At the prompt of a Claude Code terminal session, one line per mod:

```
/plugin install token-usage --marketplace tsnaketech/claude-mods
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session). Replace `token-usage` with any mod name from the table.

From a shell:

```
claude plugin install token-usage --marketplace tsnaketech/claude-mods
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `tsnaketech/claude-mods`, then **Add plugin**.

### Run from a clone

To run the mods from a local copy (edits reload live), list each mod folder in `CLAUDE_CODE_PLUGIN_DIRS`, in the `env` block of `~/.claude/settings.json`, separated by `:`:

```json
"env": {
  "CLAUDE_CODE_PLUGIN_DIRS": "~/claude-mods/token-usage:~/claude-mods/bash-guard"
}
```

## Customizing

- **Shortcuts:** edit `prompt-shortcuts/shortcuts.yaml`. Each top-level key becomes `/<name>`; `{args}` is replaced by what you type after the command; `|` keeps line breaks, `>` folds them.
- **Guard rules:** regex lists in `bash-guard/hooks/rules.ts` and `secret-guard/hooks/rules.ts`.
- **Thresholds:** constants at the top of `loop-guard`, `context-guard`, `turn-notify` and `model-router`.

## Limits

- The guards match patterns: they catch mistakes, not a determined bypass (a command hidden in a variable or `eval` gets through). `focus-mode` only covers the Edit and Write tools.
- Usage figures come with each API response of the session; usage elsewhere (another session, claude.ai) shows after the next response here. Usage needs a Claude subscription.
- On Linux, or over SSH, Claude Code plays no sound itself: `sound-events` relies on your notification channel (`/config` → notifications → terminal bell).
- Switching models mid-conversation (`model-router`) loses the prompt cache for that request.

## Development

Each mod has tests: `claude plugin test <mod>`; check one with `claude plugin validate <mod>`. See [CLAUDE.md](CLAUDE.md).

## License

[MIT](LICENSE)
