export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Limits = Limit[]
export type Sample = { t: number; pct: number }
export type Samples = Record<string, Sample[]>

declare module 'claude-code' {
  interface PluginState {
    'token-usage': { limits: Limits; isHidden: boolean; tick: number; samples: Samples }
  }
}
