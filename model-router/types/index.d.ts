export type RouterOn = boolean

declare module 'claude-code' {
  interface PluginState {
    'model-router': { isOn: RouterOn }
  }
}
