export type IsOn = boolean

declare module 'claude-code' {
  interface PluginState {
    'secret-guard': { isOn: IsOn }
  }
}
