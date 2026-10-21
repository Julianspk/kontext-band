// Stand des letzten Hauptturns: Zeitpunkt (ms) und Cache-Trefferquote (0-100)
export type CacheInfo = { at: number; hit: number }

// Belegte Tokens und Größe des Kontextfensters
export type TokenInfo = { used: number; window: number }

declare module 'claude-code' {
  interface PluginState {
    'kontext-band': {
      cache: CacheInfo | null
      kontext: number | null
      tokens: TokenInfo | null
      tick: number
      versteckt: boolean
    }
  }
}
