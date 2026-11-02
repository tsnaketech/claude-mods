// Edit to tune. Paths are tested against the full file path.
export const SECRET_FILE =
  /(^|\/)(\.env(\.(?!(example|sample|template)\b)[\w.-]+)?|id_(rsa|dsa|ecdsa|ed25519)|\.netrc|\.pgpass|credentials(\.json)?|\.npmrc|\.pypirc|secrets?\.(ya?ml|json|toml))$|\.(pem|key|p12|pfx|keystore)$|(^|\/)\.(aws|ssh|gnupg|docker)\/|(^|\/)\.kube\/config$/

// Bash commands that mention a secret file anywhere in their words.
export const mentionsSecret = (command: string) =>
  command.split(/[\s'"`;|&<>()=]+/).some(w => w !== '' && SECRET_FILE.test(w))

// Bash commands likely to print a secret to the transcript.
export const PRINTS_SECRET =
  /(^|[;&|]\s*)(printenv|env|export\s+-p|set)\s*($|[;&|])|\becho\b.*\$\{?\w*(TOKEN|SECRET|KEY|PASSWORD|PASSWD|CREDENTIAL)\w*|\bprintenv\s+\w*(TOKEN|SECRET|KEY|PASSWORD)/i
