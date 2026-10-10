import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { UsageLimit, UsageSnapshot } from '../types'

const EMPTY: UsageSnapshot = { contextPercent: null, limits: [], skills: [] }

const snapshot = atom({ plugin: 'usage-band', key: 'snapshot' } as const, EMPTY)
const isHidden = atom({ plugin: 'usage-band', key: 'isHidden' } as const, false)

const BAR_WIDTH = 8

type Meter = { key: string; icon: string; label: string; pct: number | null; reset?: string }

function resetIn(resetsAt: string | undefined, now: number): string | undefined {
  if (!resetsAt) return undefined
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  const totalMin = Math.round(ms / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

/** Colour by fill: calm → attentive → alarmed. */
function tone(pct: number | null): 'success' | 'warning' | 'error' | 'inactive' {
  if (pct === null) return 'inactive'
  if (pct >= 90) return 'error'
  if (pct >= 70) return 'warning'
  return 'success'
}

function bar(pct: number | null): { filled: string; empty: string } {
  const n = pct === null ? 0 : Math.min(BAR_WIDTH, Math.round((pct / 100) * BAR_WIDTH))
  return { filled: '━'.repeat(n), empty: '━'.repeat(BAR_WIDTH - n) }
}

function fmtPct(pct: number | null): string {
  if (pct === null) return ' —'
  return `${Math.round(pct)}%`.padStart(4)
}

const COMMAND = 'barra'
const STORE_HIDDEN = 'isHidden'

async function setHidden($: EngineInterface, hide: boolean) {
  await update($, isHidden, () => hide)
  await $.store.set(STORE_HIDDEN, hide)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Mostra ou esconde a barra de uso (contexto, limites 5h/7d, skills)',
      argumentHint: '[show|hide]',
    })
    const stored = await $.store.get(STORE_HIDDEN)
    if (typeof stored === 'boolean') await update($, isHidden, () => stored)
    const u = await $.session.usage()
    await update($, snapshot, s => ({
      ...s,
      contextPercent: u.context.percent ?? null,
      limits: u.rateLimits as UsageLimit[],
    }))
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const hide = arg === 'hide' || arg === 'off' ? true : arg === 'show' || arg === 'on' ? false : !(await read($, isHidden))
    await setHidden($, hide)
    const s = await read($, snapshot)
    const five = s.limits.find(l => l.kind === 'five_hour')
    const week = s.limits.find(l => l.kind === 'seven_day')
    const line = [
      `contexto ${fmtPct(s.contextPercent).trim()}`,
      `sessão 5h ${fmtPct(five?.percentUsed ?? null).trim()}`,
      `semana ${fmtPct(week?.percentUsed ?? null).trim()}`,
      `skills ${s.skills.length}${s.skills.length ? ': ' + s.skills.join(', ') : ''}`,
    ].join(' · ')
    return { text: `Barra de uso ${hide ? 'escondida' : 'visível'} (/barra alterna). ${line}` }
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, s => ({
      ...s,
      contextPercent: e.context.percent ?? s.contextPercent,
      limits: e.rateLimits.length ? (e.rateLimits as UsageLimit[]) : s.limits,
    }))
    return next(e)
  })

  on('skill.prompt', async ($, e, next) => {
    await update($, snapshot, s =>
      s.skills.includes(e.skill) ? s : { ...s, skills: [...s.skills, e.skill] },
    )
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const s = await read($, snapshot)
    const now = await $.clock.now()
    const { Box, Text, Button } = $.ui.resolve(e)

    const byKind = new Map(s.limits.map(l => [l.kind, l]))
    const five = byKind.get('five_hour')
    const week = byKind.get('seven_day')

    const meters: Meter[] = [
      { key: 'ctx', icon: '◐', label: 'contexto', pct: s.contextPercent },
      { key: 'five', icon: '⏱', label: 'sessão 5h', pct: five?.percentUsed ?? null, reset: resetIn(five?.resetsAt, now) },
      { key: 'week', icon: '▦', label: 'semana', pct: week?.percentUsed ?? null, reset: resetIn(week?.resetsAt, now) },
    ]

    const isNarrow = e.props.bodyColumns < 110

    return (
      <Box flexDirection="row" gap={1} paddingX={1}>
        {meters.map((m, i) => {
          const b = bar(m.pct)
          const t = tone(m.pct)
          return (
            <Box key={m.key} flexDirection="row">
              {i > 0 ? <Text color="subtle">│ </Text> : null}
              <Text color="claude">{m.icon} </Text>
              <Text color="text">{m.label} </Text>
              <Text color={t}>{b.filled}</Text>
              <Text color="inactive">{b.empty}</Text>
              <Text color={t} bold={m.pct !== null && m.pct >= 70}>{fmtPct(m.pct)}</Text>
              {m.reset && !isNarrow ? <Text color="subtle"> ↻ {m.reset}</Text> : null}
            </Box>
          )
        })}
        <Box flexDirection="row">
          <Text color="subtle">│ </Text>
          <Text color="claude">✦ </Text>
          <Text color="text">skills </Text>
          <Text color={s.skills.length ? 'suggestion' : 'inactive'} bold={s.skills.length > 0}>{String(s.skills.length)}</Text>
          {s.skills.length && !isNarrow ? (
            <Text color="subtle" wrap="truncate-end"> · {s.skills.slice(-3).join(', ')}</Text>
          ) : null}
        </Box>
        <Box flexGrow={1} />
        <Button key="hide" hotkey="h" plain dimColor label="esconder" onPress={() => setHidden($, true)} />
      </Box>
    )
  })
}
