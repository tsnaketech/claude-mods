export type IsOff = boolean

declare module 'claude-code' {
  interface PluginState {
    'bash-guard': { isOff: IsOff }
  }
}
