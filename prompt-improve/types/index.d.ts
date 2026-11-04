export type Phase = 'idle' | 'busy'

declare module 'claude-code' {
  interface PluginState {
    'prompt-improve': { hasDraft: boolean; phase: Phase }
  }
}
