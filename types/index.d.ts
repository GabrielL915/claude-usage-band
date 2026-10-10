export type UsageLimit = { kind: string; percentUsed: number; resetsAt?: string }
export type UsageSnapshot = {
  contextPercent: number | null
  limits: UsageLimit[]
  skills: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { snapshot: UsageSnapshot; isHidden: boolean }
  }
}
