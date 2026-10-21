import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { CacheInfo, TokenInfo } from '../types'

// ponytail: feste TTL von 60 min (Abo-Standard), bei 5-min-Cache hier auf 5 setzen
const TTL_MS = 60 * 60_000
const SEGMENTE = 12

// 182000 -> "182k", 1000000 -> "1M"
const kurz = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

const tokensVon = (c: { tokens?: number; window: number }): TokenInfo | null =>
  c.tokens === undefined ? null : { used: c.tokens, window: c.window }

const cache = atom({ plugin: 'kontext-band', key: 'cache' } as const, null)
const kontext = atom({ plugin: 'kontext-band', key: 'kontext' } as const, null)
const tokens = atom({ plugin: 'kontext-band', key: 'tokens' } as const, null)
const tick = atom({ plugin: 'kontext-band', key: 'tick' } as const, 0)
const versteckt = atom({ plugin: 'kontext-band', key: 'versteckt' } as const, false)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'kontext-band', description: 'Kontext-Leiste wieder einblenden' })
    const { context } = await $.session.usage()
    await update($, kontext, () => context.percent ?? null)
    await update($, tokens, () => tokensVon(context))
    // Neu zeichnen, damit der Countdown weiterläuft
    $.clock.every(15_000, () => void update($, tick, n => n + 1))

    return next(e)
  })

  on('command.run', { command: 'kontext-band' }, async $ => {
    await update($, versteckt, () => false)

    return { text: 'Kontext-Leiste eingeblendet.' }
  })

  on('session.measure', async ($, e, next) => {
    await update($, kontext, () => e.context.percent ?? null)
    await update($, tokens, () => tokensVon(e.context))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const u = e.usage
    // Nur der Hauptthread hält den Cache des Gesprächs warm
    if (e.agentId === undefined && u) {
      const gesamt = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      const info: CacheInfo = {
        at: await $.clock.now(),
        hit: gesamt ? Math.round((u.cache_read_input_tokens / gesamt) * 100) : 0,
      }
      await update($, cache, () => info)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, versteckt))) {
      return next(e)
    }

    const compact = async () => {
      $.ui.toast('Kompaktiere Kontext ...')
      try {
        const r = await $.session.compact()
        $.ui.toast(r.skip === undefined ? 'Kontext kompaktiert' : `Compact übersprungen: ${r.skip}`)
      } catch (err) {
        $.ui.toast(`Compact fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const { Box, Text, Button } = $.ui.resolve(e)
    await read($, tick)
    const c = await read($, cache)
    const k = await read($, kontext)
    const t = await read($, tokens)
    const rest = c === null ? 0 : e.props.isWorking ? TTL_MS : Math.max(0, TTL_MS - ((await $.clock.now()) - c.at))
    const min = Math.ceil(rest / 60_000)
    const voll = Math.ceil((rest / TTL_MS) * SEGMENTE)
    const cacheFarbe = min <= 5 ? 'error' : min <= 15 ? 'warning' : 'success'
    const kontextFarbe = k === null ? 'text' : k >= 85 ? 'error' : k >= 70 ? 'warning' : 'text'

    return (
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        width="100%"
        paddingX={1}
        borderStyle="round"
        borderColor="#2a2a2e"
        backgroundColor="#1c1c1f"
      >
        {/* Gruppe Cache: Restzeit, Balken, Trefferquote */}
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text color={c === null ? 'inactive' : cacheFarbe}>●</Text>
          <Text color="#e8e8e8">cache</Text>
          <Text color={cacheFarbe} weight="semibold" tabular>
            {c === null ? '–' : `${min}m`}
          </Text>
          <Text>
            <Text color="success">{'▮'.repeat(voll)}</Text>
            <Text color="#3a3a40">{'▮'.repeat(SEGMENTE - voll)}</Text>
          </Text>
          <Text color="#ffffff" weight="bold" tabular>
            {c === null ? '–' : `${c.hit}%`}
          </Text>
          <Text color="#e8e8e8">hit</Text>
        </Box>
        <Text color="#55555c">|</Text>
        {/* Gruppe Tokens: belegt von Fenstergröße */}
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text color="#ffffff" weight="bold" tabular>
            {t === null ? '–' : kurz(t.used)}
          </Text>
          <Text color="#e8e8e8">{t === null ? 'Tokens' : `/ ${kurz(t.window)} Tokens`}</Text>
        </Box>
        <Text color="#55555c">|</Text>
        {/* Gruppe Kontext: Füllstand und Compact */}
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text>{'\u{1F329}️'}</Text>
          <Text color="#e8e8e8">Kontext</Text>
          <Text color={kontextFarbe} weight="semibold" tabular>
            {k === null ? '–' : `${k}%`}
          </Text>
          {!e.props.isWorking && (
            <Button key="compact" variant="primary" label="Compact" onPress={() => void compact()} />
          )}
        </Box>
        <Button key="close" role="dismiss" plain dimColor label="x" onPress={() => void update($, versteckt, () => true)} />
      </Box>
    )
  })
}
