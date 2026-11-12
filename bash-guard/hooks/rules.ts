// Edit these lists to tune the guard. Each rule is a regex tested against the full command.

// Always refused, no question asked.
export const BLOCK: [RegExp, string][] = [
  [/\brm\s+(-\w*\s+)*-\w*[rR]\w*\s+(-\w+\s+)*(\/|~|\$HOME)\/?(\s|$|\*)/, 'recursive delete of / or home'],
  [/\bmkfs(\.\w+)?\b/, 'formats a filesystem'],
  [/\bdd\b.*\bof=\/dev\/(sd|nvme|hd|vd|disk)/, 'writes raw to a disk'],
  [/:\(\)\s*\{\s*:\|:&\s*\};:/, 'fork bomb'],
  [/>\s*\/dev\/(sd|nvme|hd|vd)\w*/, 'overwrites a disk device'],
]

// Asks you first.
const RM: [RegExp, string] = [/\brm\s+(-\w*\s+)*-\w*[rRf]/, 'rm -r / -f']

export const CONFIRM: [RegExp, string][] = [
  RM,
  [/\bgit\s+push\b.*(--force\b|--force-with-lease\b|\s-f\b)/, 'force push'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard'],
  [/\bgit\s+clean\s+-\w*f/, 'git clean -f'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'discards local changes'],
  [/\bgit\s+branch\s+-D\b/, 'force-deletes a branch'],
  [/\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, 'drops or truncates SQL data'],
  [/\bDELETE\s+FROM\s+\w+\s*(;|$|")/i, 'DELETE without WHERE'],
  [/\bchmod\s+(-\w+\s+)*-R\b.*\b777\b|\bchmod\s+777\s+-R\b/, 'chmod -R 777'],
  [/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/, 'pipes a download into a shell'],
  [/\bsudo\b/, 'runs as root'],
]

// rm -r / -f runs without asking when every target is inside one of these paths.
export const SAFE_RM: RegExp[] = [
  /(^|\/)node_modules(\/|$)/, // any node_modules folder
  /^\/tmp\/claude-\d+\//, // Claude's scratchpad and temp files
]

// Every rm in the command targets only SAFE_RM paths. `..`, `~`, `$` and backticks are refused so a path can't escape.
export const safeRm = (command: string) => {
  const rms = command.split(/&&|\|\||[;|\n]/).filter(part => RM[0].test(part))
  return rms.length > 0 && rms.every(part => {
    const words = part.trim().split(/\s+/)
    const targets = words
      .slice(words.indexOf('rm') + 1)
      .filter(w => !w.startsWith('-'))
      .map(w => w.replace(/^['"]|['"]$/g, ''))
    return targets.length > 0 && targets.every(t => !/\.\.|[~$`]/.test(t) && SAFE_RM.some(re => re.test(t)))
  })
}

export const match = (rules: [RegExp, string][], command: string) =>
  rules.find(([re]) => re.test(command))?.[1]

// The CONFIRM reason for this command, minus the rm rule when every rm is in a safe path.
export const risk = (command: string) => match(safeRm(command) ? CONFIRM.filter(r => r !== RM) : CONFIRM, command)

// `dir` is one of `roots` or inside one.
export const isUnder = (dir: string, roots: readonly string[]) =>
  roots.some(r => dir === r || dir.startsWith(r.endsWith('/') ? r : `${r}/`))
