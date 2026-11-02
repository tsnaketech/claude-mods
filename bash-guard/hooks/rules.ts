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
export const CONFIRM: [RegExp, string][] = [
  [/\brm\s+(-\w*\s+)*-\w*[rRf]/, 'rm -r / -f'],
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

export const match = (rules: [RegExp, string][], command: string) =>
  rules.find(([re]) => re.test(command))?.[1]
