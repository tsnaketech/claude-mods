export type FocusDir = string | null

declare module 'claude-code' {
  interface PluginState {
    'focus-mode': { dir: FocusDir }
  }
}
