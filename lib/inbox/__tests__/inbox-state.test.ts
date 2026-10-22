import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { inboxView, readInboxState, snoozeUntil, withInboxState } from '@/lib/inbox/state'
import { leftTabLabel, matchesTab, parseTab, waitingFor } from '@/lib/inbox/tabs'
import { decodeCursor, encodeCursor } from '@/lib/inbox/list'

describe('customFields.inbox', () => {
  it('merges into the inbox key without touching other keys', () => {
    const current = { lastTemplate: { name: 'x' }, inbox: { pinnedBy: ['a'], awaitingReply: true } }
    const next = withInboxState(current, { awaitingReply: false })
    expect(next).toEqual({ lastTemplate: { name: 'x' }, inbox: { pinnedBy: ['a'], awaitingReply: false } })
    expect(withInboxState(null, { automatedOnly: true })).toEqual({ inbox: { automatedOnly: true } })
    expect(withInboxState([1, 2], { awaitingReply: true })).toEqual({ inbox: { awaitingReply: true } })
  })

  it('reads garbage safely', () => {
    expect(readInboxState({ inbox: { pinnedBy: 'x', awaitingReply: 'yes' } })).toMatchObject({ pinnedBy: [], awaitingReply: false })
  })

  it('a snooze that ended counts as waiting for a reply', () => {
    const now = new Date('2026-10-21T15:00:00.000Z')
    const ended = inboxView({ inbox: { snoozedUntil: '2026-10-21T14:00:00.000Z' } }, 'me', now)
    expect(ended).toMatchObject({ awaitingReply: true, snoozedUntil: null })
    const active = inboxView({ inbox: { snoozedUntil: '2026-10-21T16:00:00.000Z', pinnedBy: ['me'], unreadFor: ['other'] } }, 'me', now)
    expect(active).toMatchObject({ awaitingReply: false, snoozedUntil: '2026-10-21T16:00:00.000Z', pinned: true, unreadForMe: false })
  })

  it('«mañana» is tomorrow 8:00 in Bogotá', () => {
    // 22:30 in Bogotá on the 21st (03:30 UTC on the 22nd) → 8:00 Bogotá on the 22nd = 13:00 UTC
    expect(snoozeUntil('tomorrow', new Date('2026-10-22T03:30:00.000Z')).toISOString()).toBe('2026-10-22T13:00:00.000Z')
    // 07:00 in Bogotá on the 21st → 8:00 on the 22nd
    expect(snoozeUntil('tomorrow', new Date('2026-10-21T12:00:00.000Z')).toISOString()).toBe('2026-10-22T13:00:00.000Z')
    expect(snoozeUntil('3h', new Date('2026-10-21T12:00:00.000Z')).toISOString()).toBe('2026-10-21T15:00:00.000Z')
  })
})

describe('tabs', () => {
  const nowIso = '2026-10-21T15:00:00.000Z'
  const row = (over: Record<string, unknown> = {}) => ({ status: 'OPEN', assignedToId: null, aiHandled: false, inbox: { awaitingReply: true, snoozedUntil: null }, ...over })

  it('matches the SQL rules', () => {
    expect(matchesTab(row(), 'awaiting', 'me', nowIso)).toBe(true)
    expect(matchesTab(row({ aiHandled: true }), 'awaiting', 'me', nowIso)).toBe(true)
    expect(matchesTab(row({ inbox: { awaitingReply: true, snoozedUntil: '2026-10-21T16:00:00.000Z' } }), 'awaiting', 'me', nowIso)).toBe(false)
    expect(matchesTab(row({ inbox: { awaitingReply: true, snoozedUntil: '2026-10-21T16:00:00.000Z' } }), 'snoozed', 'me', nowIso)).toBe(true)
    expect(matchesTab(row({ inbox: { awaitingReply: false, snoozedUntil: null } }), 'waiting', 'me', nowIso)).toBe(true)
    expect(matchesTab(row({ status: 'CLOSED' }), 'closed', 'me', nowIso)).toBe(true)
    expect(matchesTab(row({ assignedToId: 'me' }), 'mine', 'me', nowIso)).toBe(true)
  })

  it('labels the rows that left the tab', () => {
    expect(leftTabLabel(row(), 'awaiting', 'me', nowIso)).toBeNull()
    expect(leftTabLabel(row({ inbox: { awaitingReply: false, snoozedUntil: null } }), 'awaiting', 'me', nowIso)).toBe('Ya respondida')
    expect(leftTabLabel(row({ status: 'CLOSED' }), 'awaiting', 'me', nowIso)).toBe('Cerrada')
    expect(leftTabLabel(row({ aiHandled: true, assignedToId: null }), 'mine', 'me', nowIso)).toBe('Pasó a IA')
    expect(leftTabLabel(row(), 'closed', 'me', nowIso)).toBe('Reabierta')
  })

  it('parses tabs and waiting time', () => {
    expect(parseTab('mine')).toBe('mine')
    expect(parseTab('nope')).toBe('awaiting')
    const now = Date.parse(nowIso)
    expect(waitingFor('2026-10-21T13:00:00.000Z', now)).toBe('espera hace 2 h')
    expect(waitingFor('2026-10-21T14:55:00.000Z', now)).toBe('espera hace 5 min')
    expect(waitingFor('2026-10-19T15:00:00.000Z', now)).toBe('espera hace 2 días')
  })

  it('round-trips the list cursor and rejects junk', () => {
    const c = { p: true, t: '2026-10-21T15:00:00.000Z', i: 'abc' }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
    expect(decodeCursor('not-a-cursor')).toBeNull()
    expect(decodeCursor(encodeCursor({ p: false, t: 'x', i: 'y' }))).toBeNull()
  })
})
