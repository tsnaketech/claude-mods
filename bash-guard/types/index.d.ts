export type IsOn = boolean

declare module 'claude-code' {
  interface PluginState {
    'bash-guard': { isOn: IsOn }
  }
}
