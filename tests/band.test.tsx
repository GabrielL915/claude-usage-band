import { test, expect, mock } from 'claude-code/testing'

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0)
const PROPS = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 140, scroll: { offset: 0, bodyRows: 10 } }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`band shows context, limits and skills on ${surface}`, async ($, on) => {
    mock.clock(on, { now: NOW })
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    on('skill.prompt', (_$, e) => ({ text: e.text }))

    await $.session.measure({
      context: { window: 200000, tokens: 84000, percent: 42 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 12.5, resetsAt: new Date(NOW + 3 * 3600_000 + 5 * 60_000).toISOString() },
        { kind: 'seven_day', percentUsed: 91, resetsAt: new Date(NOW + 2 * 86400_000 + 4 * 3600_000).toISOString() },
      ],
      changed: ['context', 'rateLimits'],
    })
    await $.skill.prompt({ skill: 'plugin-authoring', text: 'x' })

    const band = await $.ui.mount({ plugin: 'usage-band', surface, component: 'AbovePrompt', props: PROPS })

    expect(await band.find({ text: /contexto/ })).toBeDefined()
    expect(await band.find({ text: /42%/ })).toBeDefined()
    expect(await band.find({ text: /3h 05m/ })).toBeDefined()
    expect(await band.find({ text: /2d 4h/ })).toBeDefined()
    const week = await band.find({ type: 'Text', text: /91%/ })
    expect(week?.props.color).toBe('error')
    expect(await band.find({ text: /plugin-authoring/ })).toBeDefined()
  })
}

test('band hides reset and skill names when narrow', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { window: 200000, percent: 7 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 6, resetsAt: new Date(NOW + 3600_000).toISOString() }],
    changed: ['context'],
  })
  const band = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', component: 'AbovePrompt', props: { ...PROPS, bodyColumns: 90 } })
  expect(await band.find({ text: /↻/ })).toBeUndefined()
  expect(await band.find({ text: /7%/ })).toBeDefined()
})

test('/barra toggles the band and the button hides it', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on, {})
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => { const { Text } = $.ui.resolve(e); return <Text key="engine">engine</Text> })
  await $.session.measure({ context: { window: 200000, percent: 7 }, rateLimits: [], changed: ['context'] })

  const band = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', component: 'AbovePrompt', props: PROPS })
  expect(await band.find({ text: /contexto/ })).toBeDefined()
  await band.press({ key: 'hide' })
  expect(await band.find({ text: /contexto/ })).toBeUndefined()

  const shown = await $.command.run({ command: 'barra', args: '' })
  expect(shown.text).toContain('visível')
  expect(shown.text).toContain('contexto 7%')
  expect(await band.find({ text: /contexto/ })).toBeDefined()

  const hidden = await $.command.run({ command: 'barra', args: 'hide' })
  expect(hidden.text).toContain('escondida')
  expect(await band.find({ text: /contexto/ })).toBeUndefined()
})

test('a hidden state stored by an earlier session is honoured at session.start', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on, { isHidden: true })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200000, percent: 7 }, rateLimits: [] } }))
  on('command.register', () => ({ value: undefined }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => { const { Text } = $.ui.resolve(e); return <Text key="engine">engine</Text> })

  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', component: 'AbovePrompt', props: PROPS })
  expect(await band.find({ text: /contexto/ })).toBeUndefined()

  const shown = await $.command.run({ command: 'barra', args: 'show' })
  expect(shown.text).toContain('visível')
  expect(await band.find({ text: /contexto 7%|7%/ })).toBeDefined()
})
