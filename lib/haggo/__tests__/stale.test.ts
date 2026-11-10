import { describe, expect, it } from 'vitest'
import { detect, staleHaggoItems, titleOverlap, type Snapshot } from '@/lib/haggo/detect'

const now = new Date('2026-11-09T12:00:00-05:00')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000)

describe('lo que Haggo abrió se cierra solo cuando la condición desaparece', () => {
  it('un incidente ligado a una regla se cierra cuando la regla deja de detectarlo (no si una fuente falló)', () => {
    const incidents = [{ id: 'i1', type: 'haggo:rule:mk:no-drafts:a1', title: 'Agente sin redactar', lastSeenAt: hoursAgo(1) }]
    expect(staleHaggoItems({ now, detectionKeys: [], findings: [], incidents }).incidents).toEqual(['i1'])
    expect(staleHaggoItems({ now, detectionKeys: ['mk:no-drafts:a1'], findings: [], incidents }).incidents).toEqual([])
    expect(staleHaggoItems({ now, detectionKeys: null, findings: [], incidents }).incidents).toEqual([])
  })
  it('hallazgos de IA que no se repiten en 48 h se resuelven, y con ellos el incidente que describían', () => {
    const findings = [
      { id: 'f1', fingerprint: 'ai:marketing:agente-de-redaccion-con-0-ejecuciones-en-48-h', title: 'Agente de redacción con 0 ejecuciones en 48 h', lastSeenAt: hoursAgo(72) },
      { id: 'f2', fingerprint: 'rule:mk:failed', title: '3 publicaciones fallaron en 7 días', lastSeenAt: hoursAgo(80) },
    ]
    const incidents = [
      { id: 'i1', type: 'haggo', title: 'Agente de redacción con 0 ejecuciones en 48 h', lastSeenAt: hoursAgo(300) },
      { id: 'i2', type: 'haggo', title: 'Pipeline editorial publica aunque la revisión falle (bypass del gate)', lastSeenAt: hoursAgo(300) },
      { id: 'i3', type: 'haggo', title: 'Algo reciente', lastSeenAt: hoursAgo(5) },
      { id: 'i4', type: 'marketing:gap:x', title: 'Otro sistema', lastSeenAt: hoursAgo(300) },
    ]
    const r = staleHaggoItems({ now, detectionKeys: [], findings, incidents })
    // Rule findings follow their rule (syncRuleFindings), not this clock
    expect(r.findings).toEqual(['f1'])
    expect(r.incidents).toEqual(['i1', 'i2'])
  })
  it('un hallazgo vivo que describe el incidente lo mantiene abierto', () => {
    const findings = [{ id: 'f1', fingerprint: 'ai:marketing:x', title: 'El pipeline editorial publica piezas sin revisión', lastSeenAt: hoursAgo(2) }]
    const incidents = [{ id: 'i2', type: 'haggo', title: 'Pipeline editorial publica aunque la revisión falle', lastSeenAt: hoursAgo(300) }]
    expect(titleOverlap(findings[0].title, incidents[0].title)).toBeGreaterThanOrEqual(0.5)
    expect(staleHaggoItems({ now, detectionKeys: [], findings, incidents }).incidents).toEqual([])
  })
})

describe('regla: agente que no redacta', () => {
  const base = {
    at: now.toISOString(),
    sales: { today: 0, todayDelta: null, month: 0, monthDelta: null, last7: 0, prev7: 0 },
    bookings: { today: 0, pending: 0, cancelledToday: 0, last7: 0, prev7: 0 },
    requests: { active: 0, withoutProposals: 0 },
    partners: { available: 1, verified: 1, pendingVerification: 0 },
    payouts: { pending: 0, failed: 0, paymentsToConfirm: 0 },
    payments: { rejected24h: 0, pendingOld: 0, refundsOpen: 0 },
    reviews: { low7d: 0 },
    search: { total24h: 0, zero24h: 0 },
    messaging: { sent24h: 0, failed24h: 0 },
    security: { events24h: 0, high24h: 0, blockedIps: 0 },
    inbox: { open: 0, unassigned: 0, waiting: 0, aiHandling: 0, inboundToday: 0, handoffsToday: 0 },
    aiAgents: [],
    aiActions: { actionsToday: { executed: 0, failed: 0, awaiting: 0 }, chatCancellationsToday: 0, cancellationsToday: 0 },
    aiCost: { today: 0, month: 0 },
    aiProviders: { down: [], answering: null },
    quality: { rating: null, casesOpen: 0, casesSla: 0 },
    channels: { problems: [] },
    system: { cronsFailing: 0, cronsLate: 0, errorsLastHour: 0, criticalIncidents: 0 },
    budgets: [],
  }
  const snap = (drafts48h: number): Snapshot => ({ ...base, marketing: { inReview: 0, failedWeek: 0, scheduledToday: 0, ideasPending: 0, runErrors24h: 0, degraded: [], drafting: [{ id: 'a1', campaign: 'Siempre', drafts48h }] } })
  it('se detecta con el conteo real y desaparece cuando vuelve a redactar', () => {
    expect(detect(snap(0)).map((d) => d.key)).toContain('mk:no-drafts:a1')
    expect(detect(snap(4)).map((d) => d.key)).not.toContain('mk:no-drafts:a1')
  })
})
