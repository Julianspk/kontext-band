import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'kontext-band',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 3 },
    view: {},
  },
} as const

test('Leiste zeigt Restzeit, Trefferquote und Kontext', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const toasts: string[] = []
  let kompaktiert = 0
  on('ui.toast', (_, e) => (toasts.push(e.text), { value: undefined }))
  on('session.compact', () => (kompaktiert++, { skip: 'Test' }))
  on('command.register', () => ({ value: { command: 'kontext-band' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // Steht für die Zeichnung der Engine, wenn die Leiste ausgeblendet ist
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] },
  }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: { window: 200_000, tokens: 182_000, percent: 91 },
    rateLimits: [],
    changed: ['context'],
  })
  await $.turn.complete({
    answer: '',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      model: 'm',
      input_tokens: 70,
      output_tokens: 10,
      cache_read_input_tokens: 930,
      cache_creation_input_tokens: 0,
    },
  })
  // 57 Minuten später: noch 3 Minuten Cache
  await clock.advance(57 * 60_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^3m$/ }))?.text).toBe('3m')
    expect((await ui.find({ type: 'Text', text: /^93%$/ }))?.text).toBe('93%')
    expect((await ui.find({ type: 'Text', text: /^91%$/ }))?.text).toBe('91%')
    expect((await ui.find({ type: 'Text', text: /^182k$/ }))?.text).toBe('182k')
    expect((await ui.find({ type: 'Text', text: /^\/ 200k Tokens$/ }))?.text).toBe('/ 200k Tokens')
    expect(await ui.find({ type: 'Button', key: 'compact' })).toBeTruthy()
    await ui.unmount()
  }

  // Compact löst die Kompaktierung aus und meldet das Ergebnis
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'compact' })
  expect(kompaktiert).toBe(1)
  expect(toasts.at(-1)).toBe('Compact übersprungen: Test')

  // Läuft ein Turn, bleibt der Button da, löst aber nichts aus
  const arbeitet = await $.ui.mount({ ...BAND, props: { ...BAND.props, isWorking: true }, surface: 'desktop' })
  expect(await arbeitet.find({ type: 'Button', key: 'compact' })).toBeTruthy()
  await arbeitet.press({ key: 'compact' })
  expect(kompaktiert).toBe(1)
  expect(toasts.at(-1)).toBe('Compact erst nach dem laufenden Turn möglich')
  await arbeitet.unmount()

  // x blendet die Leiste aus, der Befehl holt sie zurück
  await ui.press({ key: 'close' })
  expect(await ui.find({ type: 'Button', key: 'compact' })).toBeUndefined()
  await $.command.run({
    command: 'kontext-band',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  expect(await ui.find({ type: 'Button', key: 'compact' })).toBeTruthy()
  await ui.unmount()
})
