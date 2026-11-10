import { describe, expect, it } from 'vitest'
import {
  classifyReply, convertedBy, copilotCounts, csvCell, firstRealReplies, isCannedText, median, metricsToCsv, parseChannel,
  percentile, readTimeline, summarizeConversations, toDate, type ConversationInput, type ReplyCandidate,
} from '@/lib/inbox/metrics-core'

const anchor = new Date('2026-11-02T15:00:00Z')
const at = (sec: number) => new Date(anchor.getTime() + sec * 1000).toISOString()
const msg = (sec: number, m: Partial<ReplyCandidate>): ReplyCandidate => ({ sentAt: at(sec), senderType: null, sentById: null, aiAgentId: null, body: 'Hola, claro que sí te ayudo', ...m })
const canned = new Map([['agent1', ['Te comunico con una persona del equipo, en un momento te responde.']]])

describe('percentiles', () => {
  it('interpolates median and p90', () => {
    expect(median([])).toBeNull()
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1)
    expect(percentile([7], 0.9)).toBe(7)
  })

  it('reads zone-less json timestamps as UTC', () => {
    expect(toDate('2026-11-02T15:00:00.000')?.toISOString()).toBe('2026-11-02T15:00:00.000Z')
    expect(toDate('2026-11-02T15:00:00Z')?.toISOString()).toBe('2026-11-02T15:00:00.000Z')
    expect(toDate(null)).toBeNull()
  })

  it('parses the channel filter', () => {
    expect(parseChannel('WHATSAPP')).toBe('WHATSAPP')
    expect(parseChannel('FACEBOOK_COMMENT')).toBeNull()
    expect(parseChannel(null)).toBeNull()
  })
})

describe('real replies', () => {
  it('ignores automations, the survey, follow-ups, the relay, holding messages and canned texts', () => {
    expect(classifyReply(msg(2, { senderType: 'AUTOMATION' }), anchor)).toBeNull()
    expect(classifyReply(msg(2, { senderType: 'AI', aiAgentId: 'csat' }), anchor)).toBeNull()
    expect(classifyReply(msg(2, { senderType: 'AI', aiAgentId: 'booking-followup' }), anchor)).toBeNull()
    expect(classifyReply(msg(2, { senderType: 'AI', aiAgentId: 'chat-relay' }), anchor)).toBeNull()
    expect(classifyReply(msg(2, { senderType: 'AI', aiAgentId: 'agent1', nearHolding: true }), anchor)).toBeNull()
    expect(classifyReply(msg(2, { senderType: 'AI', aiAgentId: 'agent1', body: 'Te comunico con una persona del equipo, en un momento te responde.\n\n— Sofi' }), anchor, canned)).toBeNull()
    expect(classifyReply(msg(2, { senderType: 'AI', aiAgentId: 'agent1', body: 'Gracias por escribirnos. Ahora estamos fuera de horario; te respondemos en cuanto abramos.' }), anchor)).toBeNull()
    expect(classifyReply(msg(2, { senderType: 'HUMAN', sentById: 'u1', isInternal: true }), anchor)).toBeNull()
    expect(classifyReply(msg(-5, { senderType: 'HUMAN', sentById: 'u1' }), anchor)).toBeNull()
  })

  it('counts agents and people, and treats an instant Meta echo as automatic', () => {
    expect(classifyReply(msg(6, { senderType: 'AI', aiAgentId: 'agent1' }), anchor, canned)).toBe('ai')
    expect(classifyReply(msg(60, { senderType: 'HUMAN', sentById: 'u1' }), anchor)).toBe('human')
    expect(classifyReply(msg(2, { senderType: 'ECHO' }), anchor)).toBeNull()
    expect(classifyReply(msg(90, { senderType: 'ECHO' }), anchor)).toBe('human')
  })

  it('finds the first real reply of each kind after the notices', () => {
    const r = firstRealReplies([
      msg(300, { senderType: 'HUMAN', sentById: 'u1' }),
      msg(3, { senderType: 'AI', aiAgentId: 'csat' }),
      msg(4, { senderType: 'AI', aiAgentId: 'agent1', nearHolding: true }),
      msg(40, { senderType: 'AI', aiAgentId: 'agent1' }),
    ], anchor, canned)
    expect(r.ai?.agentId).toBe('agent1')
    expect(r.ai?.at.toISOString()).toBe(at(40))
    expect(r.human?.by).toBe('u1')
    expect(r.first).toEqual({ at: new Date(at(40)), kind: 'ai' })
    expect(firstRealReplies([msg(3, { senderType: 'AUTOMATION' })], anchor).first).toBeNull()
  })

  it('needs a long enough canned prefix', () => {
    expect(isCannedText('Hola', ['Hola'])).toBe(false)
    expect(isCannedText('Te comunico con una PERSONA del equipo...', ['Te comunico con una persona del equipo'])).toBe(true)
  })
})

describe('timeline', () => {
  it('splits resolution from inactivity closes and reads handoff, survey and accounts', () => {
    const t = readTimeline([
      { type: 'ai_handoff', actorType: 'ai', actorId: 'agent1', actorName: 'Sofi', detail: 'Pidió una persona: quiere hablar', createdAt: at(10) },
      { type: 'ai_closed', actorType: 'ai', actorId: 'agent1', actorName: 'Sofi', detail: 'Sin respuesta del cliente', createdAt: at(100) },
      { type: 'status', actorType: 'ai', actorId: 'agent1', actorName: 'Sofi', detail: 'RESOLVED', createdAt: at(100) },
      { type: 'status', actorType: 'user', actorId: 'u1', actorName: 'Ana', detail: 'RESOLVED', createdAt: at(500) },
      { type: 'csat_asked', actorType: 'system', actorId: null, actorName: 'Encuesta', detail: null, createdAt: at(501) },
      { type: 'csat_answered', actorType: 'contact', actorId: null, actorName: null, detail: '4/5', createdAt: at(600) },
      { type: 'account_linked', actorType: 'ai', actorId: 'agent1', actorName: 'Sofi', detail: null, createdAt: at(50) },
    ])
    expect(t.autoClosed).toBe(true)
    expect(t.resolution).toEqual({ at: new Date(at(500)), actorType: 'user', actorId: 'u1' })
    expect(t.closes).toHaveLength(2)
    expect(t.handoff?.agentId).toBe('agent1')
    expect(t.csatAsked).toBe(true)
    expect(t.csatScore).toBe(4)
    expect(t.newAccount).toBe(true)
  })

  it('treats the inbox cleanup as an inactivity close', () => {
    const t = readTimeline([{ type: 'status', actorType: 'system', actorId: 'a', actorName: 'Limpieza de la bandeja (Ana)', detail: 'CLOSED', createdAt: at(10) }])
    expect(t.autoClosed).toBe(true)
    expect(t.resolution).toBeNull()
  })
})

describe('conversion funnel', () => {
  const conv = { id: 'c1', userId: 'user1', anchor }
  it('matches the origin conversation or the same account within the window', () => {
    expect(convertedBy(conv, [{ userId: 'other', originConversationId: 'c1', createdAt: at(10) }], 1000)).toBe(true)
    expect(convertedBy(conv, [{ userId: 'user1', originConversationId: null, createdAt: at(500) }], 1000_000)).toBe(true)
    expect(convertedBy(conv, [{ userId: 'user1', originConversationId: null, createdAt: at(-500) }], 1000_000)).toBe(false)
    expect(convertedBy(conv, [{ userId: 'user1', originConversationId: null, createdAt: at(5000) }], 1000)).toBe(false)
    expect(convertedBy({ ...conv, userId: null }, [{ userId: 'user1', originConversationId: null, createdAt: at(10) }], 1000_000)).toBe(false)
  })
})

describe('summary', () => {
  const rows: ConversationInput[] = [
    {
      id: 'c1', channel: 'WHATSAPP', status: 'RESOLVED', userId: 'user1', firstIn: anchor.toISOString().replace('Z', ''), lastIn: null,
      candidates: [msg(1, { senderType: 'AI', aiAgentId: 'csat' }), msg(30, { senderType: 'AI', aiAgentId: 'agent1' })],
      humans: [], agents: ['agent1'],
      events: [
        { type: 'status', actorType: 'ai', actorId: 'agent1', actorName: 'Sofi', detail: 'RESOLVED', createdAt: at(600) },
        { type: 'csat_asked', actorType: 'system', actorId: null, actorName: null, detail: null, createdAt: at(601) },
        { type: 'csat_answered', actorType: 'contact', actorId: null, actorName: null, detail: '5/5', createdAt: at(700) },
      ],
    },
    {
      id: 'c2', channel: 'INSTAGRAM', status: 'OPEN', userId: null, firstIn: anchor, lastIn: at(2000),
      candidates: [msg(5, { senderType: 'AI', aiAgentId: 'agent1', body: 'Te comunico con una persona del equipo, en un momento te responde.' }), msg(1205, { senderType: 'HUMAN', sentById: 'u1' })],
      humans: ['u1'], agents: ['agent1'],
      events: [
        { type: 'ai_handoff', actorType: 'ai', actorId: 'agent1', actorName: 'Sofi', detail: 'Pidió una persona', createdAt: at(5) },
        { type: 'status', actorType: 'user', actorId: 'u1', actorName: 'Ana', detail: 'CLOSED', createdAt: at(1500) },
      ],
    },
    { id: 'c3', channel: 'WHATSAPP', status: 'OPEN', userId: 'user3', firstIn: anchor, lastIn: null, candidates: [msg(2, { senderType: 'AUTOMATION' })], humans: [], agents: [], events: [] },
  ]
  const s = summarizeConversations(rows, {
    canned,
    requests: [{ userId: 'user1', originConversationId: 'c1', createdAt: at(400) }],
    bookings: [{ userId: 'user1', originConversationId: null, createdAt: at(4000) }],
    isTeamHours: () => true,
  })

  it('splits the first response between AI and people', () => {
    expect(s.firstResponse.ai).toEqual({ count: 1, medianSeconds: 30, p90Seconds: 30 })
    // Measured from the handoff, not from the contact's first message
    expect(s.firstResponse.human.medianSeconds).toBe(1200)
    expect(s.firstResponse.any.count).toBe(2)
    expect(s.firstResponse.unanswered).toBe(1)
    expect(s.firstResponse.insideHours.count).toBe(2)
  })

  it('measures resolution, reopenings, handoffs and CSAT', () => {
    expect(s.resolution.resolved).toBe(2)
    expect(s.resolution.medianSeconds).toBe(1050)
    expect(s.reopened).toBe(1)
    expect(s.ai).toEqual({ involved: 2, closed: 2, byAi: 1, rate: 0.5 })
    expect(s.handoffs.total).toBe(1)
    expect(s.handoffs.rate).toBe(0.5)
    expect(s.handoffs.top).toEqual([{ reason: 'Pidió una persona', count: 1 }])
    expect(s.csat).toEqual({ asked: 1, answered: 1, average: 5, distribution: [0, 0, 0, 0, 1] })
  })

  it('builds the funnel per channel', () => {
    expect(s.funnel.total).toEqual({ conversations: 3, withAccount: 2, newAccounts: 0, requests: 1, bookings: 1 })
    expect(s.funnel.byChannel.find((c) => c.channel === 'WHATSAPP')).toMatchObject({ conversations: 2, requests: 1, bookings: 1 })
  })

  it('breaks down by person and AI agent', () => {
    expect(s.people).toEqual([{ id: 'u1', conversations: 1, firstResponse: { count: 1, medianSeconds: 1200, p90Seconds: 1200 }, resolved: 1, csatAverage: null, csatCount: 0, handoffs: 1 }])
    expect(s.agents[0]).toMatchObject({ id: 'agent1', conversations: 2, resolved: 1, csatAverage: 5, handoffs: 1 })
    expect(s.agents[0].firstResponse.count).toBe(1)
  })

  it('exports a CSV with names only', () => {
    const csv = metricsToCsv({
      ...s, days: 7, channel: null, since: anchor.toISOString(),
      people: s.people.map((p) => ({ ...p, name: 'Ana' })),
      agents: s.agents.map((a) => ({ ...a, name: 'Sofi' })),
      copilot: copilotCounts([]),
    })
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"Persona","Ana","1"')
    expect(csv).toContain('"Agente IA","Sofi","2"')
    expect(csv).not.toContain('user1')
  })
})

describe('copilot and csv helpers', () => {
  it('counts every suggestion status, old and new', () => {
    const c = copilotCounts([{ status: 'used', count: 3 }, { status: 'discarded', count: 2 }, { status: 'expired', count: 4 }, { status: 'edited', count: 1 }, { status: 'ignored', count: 2 }])
    expect(c).toMatchObject({ generated: 12, used: 3, edited: 1, discarded: 2, expired: 4, ignored: 2 })
    expect(c.useRate).toBeCloseTo(4 / 12)
    expect(copilotCounts([]).useRate).toBeNull()
  })

  it('neutralizes formulas in CSV cells', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvCell(null)).toBe('""')
  })
})
