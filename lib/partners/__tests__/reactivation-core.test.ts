import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REACTIVATION_CONFIG, bogotaDayStart, controlBucket, conversionReport, enrollmentOrder, inSendingWindow, isControl,
  parseRxDetails, planPartner, rankDemand, resolveTemplate, sanitizeReactivationConfig, segmentOf, sequenceFor, serviceTextFor, smsText,
  type PartnerSnapshot, type PlanInput, type RxRow, type WaCode,
} from '@/lib/partners/reactivation-core'
import { servicesToActivate } from '@/lib/partners/service-cap'

const DAY = 24 * 3600_000
// Tuesday 2026-11-10, 15:00 UTC = 10:00 Bogotá
const NOW = new Date('2026-11-10T15:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * DAY)

function snap(over: Partial<PartnerSnapshot> = {}): PartnerSnapshot {
  return {
    userId: 'u1', partnerId: 'p1', name: 'Ana María Pérez', email: 'ana@example.com', phone: '+573001112233', city: 'MEDELLIN', slug: 'ana-medellin',
    verified: false, active: true, excludedFromMarketing: false, createdAt: ago(120),
    docs: [], services: [], proposals: 0, lastProposalAt: null, lastBookingAt: null,
    ...over,
  }
}
const svc = (serviceId: string, active = true, createdAt = ago(100)) => ({ serviceId, name: serviceId === 's1' ? 'Pintura' : 'Plomería', active, city: 'MEDELLIN', createdAt })
const cfg = DEFAULT_REACTIVATION_CONFIG
const allApproved = () => true
const noneApproved = () => false

function input(over: Partial<PlanInput> = {}): PlanInput {
  const s = over.snapshot ?? snap()
  return { snapshot: s, segmentNow: segmentOf(s, NOW), rows: [], cfg, now: NOW, lastInboundAt: null, marketingWa14d: 0, optedOut: false, approved: allApproved, ...over }
}
const enrollRow = (segment: RxRow['segment'], at: Date, control = false): RxRow => ({ step: 'enroll', status: 'enrolled', segment, control, at, activeServices: 0 })
const sentRow = (step: RxRow['step'], at: Date, segment: RxRow['segment'] = 'B', channel: RxRow['channel'] = 'whatsapp'): RxRow => ({ step, status: 'sent', segment, channel, at })

describe('segmentos', () => {
  it('A/B sin documentos según servicios activos', () => {
    expect(segmentOf(snap(), NOW)).toBe('A')
    expect(segmentOf(snap({ services: [svc('s1', false)] }), NOW)).toBe('A')
    expect(segmentOf(snap({ services: [svc('s1')] }), NOW)).toBe('B')
  })
  it('D si hay un documento por revisar, E si el único de su tipo fue rechazado, C si incompleto', () => {
    expect(segmentOf(snap({ docs: [{ type: 'CEDULA_CIUDADANIA', status: 'PENDING', createdAt: ago(1) }] }), NOW)).toBe('D')
    expect(segmentOf(snap({ docs: [{ type: 'CEDULA_CIUDADANIA', status: 'REJECTED', createdAt: ago(9) }] }), NOW)).toBe('E')
    expect(segmentOf(snap({ docs: [{ type: 'CEDULA_CIUDADANIA', status: 'APPROVED', createdAt: ago(9) }] }), NOW)).toBe('C')
    expect(segmentOf(snap({ docs: [{ type: 'CEDULA_CIUDADANIA', status: 'REJECTED', createdAt: ago(9) }, { type: 'CEDULA_CIUDADANIA', status: 'APPROVED', createdAt: ago(5) }] }), NOW)).toBe('C')
  })
  it('verificados: G activo 30 días, F sin propuestas, H con propuestas viejas', () => {
    expect(segmentOf(snap({ verified: true }), NOW)).toBe('F')
    expect(segmentOf(snap({ verified: true, proposals: 2, lastProposalAt: ago(45) }), NOW)).toBe('H')
    expect(segmentOf(snap({ verified: true, proposals: 2, lastProposalAt: ago(10) }), NOW)).toBe('G')
    expect(segmentOf(snap({ verified: true, lastBookingAt: ago(3) }), NOW)).toBe('G')
  })
  it('cuenta inactiva: fuera', () => {
    expect(segmentOf(snap({ active: false }), NOW)).toBeNull()
  })
})

describe('grupo de control', () => {
  it('es determinístico y respeta el porcentaje', () => {
    expect(controlBucket('abc')).toBe(controlBucket('abc'))
    expect(isControl('abc', 0)).toBe(false)
    expect(isControl('abc', 100)).toBe(true)
    const ids = Array.from({ length: 2000 }, (_, i) => `user_${i}`)
    const share = ids.filter((id) => isControl(id, 20)).length / ids.length
    expect(share).toBeGreaterThan(0.15)
    expect(share).toBeLessThan(0.25)
  })
})

describe('config', () => {
  it('sin fila usa los valores por defecto (encendida)', () => {
    const c = sanitizeReactivationConfig(null)
    expect(c).toEqual(DEFAULT_REACTIVATION_CONFIG)
    expect(c.enabled).toBe(true)
    expect(c.controlPct).toBe(20)
  })
  it('acota valores fuera de rango y respeta el orden de horas', () => {
    const c = sanitizeReactivationConfig({ controlPct: 90, dailyLimit: '0', startHour: 18, endHour: 10, days: { sms: -3, lastWa: 'x' }, segments: { A: false }, paused: 'sí' })
    expect(c.controlPct).toBe(50)
    expect(c.dailyLimit).toBe(1)
    expect(c.startHour).toBe(18)
    expect(c.endHour).toBe(19)
    expect(c.days.sms).toBe(0)
    expect(c.days.lastWa).toBe(10)
    expect(c.segments).toEqual({ A: false, B: true, F: true, H: true })
    expect(c.paused).toBe(false)
  })
})

describe('plantillas y respaldo', () => {
  const step = sequenceFor('B', cfg)[0]
  it('usa la nueva si está aprobada', () => {
    expect(resolveTemplate(step, allApproved, 0, 3)).toEqual({ kind: 'use', template: 'C46', fallback: false })
  })
  it('espera la aprobación y luego usa el respaldo aprobado', () => {
    const onlyOld = (c: WaCode) => c === 'C3'
    expect(resolveTemplate(step, onlyOld, 2 * DAY, 3)).toEqual({ kind: 'wait' })
    expect(resolveTemplate(step, onlyOld, 3 * DAY, 3)).toEqual({ kind: 'use', template: 'C3', fallback: true })
  })
  it('sin respaldo (C47) se salta', () => {
    const guide = sequenceFor('B', cfg).find((s) => s.key === 'guide_wa')!
    expect(resolveTemplate(guide, noneApproved, 4 * DAY, 3)).toEqual({ kind: 'skip' })
  })
  it('C49 cae a C33', () => {
    const act = sequenceFor('F', cfg)[0]
    expect(resolveTemplate(act, (c) => c === 'C33', 5 * DAY, 3)).toEqual({ kind: 'use', template: 'C33', fallback: true })
  })
})

describe('secuencias', () => {
  it('A/B: WhatsApp + correo día 0, guía, SMS, último aviso', () => {
    expect(sequenceFor('A', cfg).map((s) => `${s.key}@${s.day}`)).toEqual(['docs_wa@0', 'docs_email@0', 'guide_wa@3', 'sms@7', 'last_wa@10'])
  })
  it('F lleva correo de consejos; H no', () => {
    expect(sequenceFor('F', cfg).map((s) => s.key)).toEqual(['activate_wa', 'demand_wa', 'tips_email'])
    expect(sequenceFor('H', cfg).map((s) => s.key)).toEqual(['activate_wa', 'demand_wa'])
  })
})

describe('planificación', () => {
  it('inscribe a un socio elegible (o al control) y deja fuera C/E como tarea', () => {
    const p = planPartner(input({ snapshot: snap({ services: [svc('s1')] }) }))
    expect(p).toEqual({ kind: 'enroll', segment: 'B', control: isControl('u1', 20) })
    const e = snap({ docs: [{ type: 'CEDULA_CIUDADANIA', status: 'REJECTED', createdAt: ago(9) }] })
    expect(planPartner(input({ snapshot: e }))).toEqual({ kind: 'followup', segment: 'E' })
    expect(planPartner(input({ snapshot: e, rows: [{ step: 'followup', status: 'task', segment: 'E', at: ago(1) }] }))).toEqual({ kind: 'ignore' })
  })
  it('no inscribe sin celular, con baja o segmento apagado', () => {
    expect(planPartner(input({ snapshot: snap({ phone: null }) })).kind).toBe('ignore')
    expect(planPartner(input({ optedOut: true })).kind).toBe('ignore')
    expect(planPartner(input({ cfg: { ...cfg, segments: { ...cfg.segments, A: false } } })).kind).toBe('ignore')
  })
  it('el control nunca recibe nada', () => {
    expect(planPartner(input({ rows: [enrollRow('A', ago(1), true)] }))).toEqual({ kind: 'control' })
  })
  it('día 0: envía C46; con C46 en revisión espera pero el correo sale igual', () => {
    const rows = [enrollRow('A', NOW)]
    const send = planPartner(input({ rows }))
    expect(send).toMatchObject({ kind: 'send', template: 'C46', step: { key: 'docs_wa' } })
    const held = planPartner(input({ rows, approved: (c) => c === 'C3' }))
    expect(held).toMatchObject({ kind: 'send', step: { key: 'docs_email' } })
    const afterEmail = planPartner(input({ rows: [...rows, sentRow('docs_email', NOW, 'A', 'email')], approved: (c) => c === 'C3' }))
    expect(afterEmail).toMatchObject({ kind: 'wait', reason: 'approval' })
  })
  it('tras esperar la aprobación usa C3', () => {
    const rows = [enrollRow('B', ago(3.5)), sentRow('docs_email', ago(3.5), 'B', 'email')]
    expect(planPartner(input({ snapshot: snap({ services: [svc('s1')] }), rows, approved: (c) => c === 'C3' }))).toMatchObject({ kind: 'send', template: 'C3', fallback: true })
  })
  it('respeta el día del paso y la separación mínima', () => {
    const rows = [enrollRow('A', ago(2)), sentRow('docs_wa', ago(2), 'A'), sentRow('docs_email', ago(2), 'A', 'email')]
    expect(planPartner(input({ rows }))).toMatchObject({ kind: 'wait', reason: 'not_due', step: { key: 'guide_wa' } })
    const late = [enrollRow('A', ago(8)), sentRow('docs_wa', ago(8), 'A'), sentRow('docs_email', ago(8), 'A', 'email'), sentRow('guide_wa', ago(0.2), 'A')]
    expect(planPartner(input({ rows: late }))).toMatchObject({ kind: 'wait', reason: 'not_due', step: { key: 'sms' } })
  })
  it('tope de marketing: el WhatsApp espera', () => {
    const rows = [enrollRow('A', ago(4)), sentRow('docs_wa', ago(4), 'A'), sentRow('docs_email', ago(4), 'A', 'email')]
    expect(planPartner(input({ rows, marketingWa14d: 3 }))).toMatchObject({ kind: 'wait', reason: 'cap' })
  })
  it('canal apagado: el paso se salta', () => {
    const rows = [enrollRow('A', ago(8)), sentRow('docs_wa', ago(8), 'A'), sentRow('docs_email', ago(8), 'A', 'email'), sentRow('guide_wa', ago(5), 'A')]
    expect(planPartner(input({ rows, cfg: { ...cfg, smsEnabled: false } }))).toMatchObject({ kind: 'skip', step: { key: 'sms' }, reason: 'disabled' })
  })
  it('termina la secuencia', () => {
    const rows = [enrollRow('H', ago(10)), sentRow('activate_wa', ago(10), 'H'), { ...sentRow('demand_wa', ago(5), 'H'), status: 'skipped' as const }]
    expect(planPartner(input({ snapshot: snap({ verified: true, proposals: 1, lastProposalAt: ago(60) }), rows }))).toEqual({ kind: 'exit', reason: 'completed' })
  })
})

describe('reglas de parada', () => {
  const rows = [enrollRow('B', ago(2)), sentRow('docs_wa', ago(2))]
  const b = (over: Partial<PartnerSnapshot>) => snap({ services: [svc('s1')], ...over })
  it('sale al verificarse, subir documentos, darse de baja o desactivarse', () => {
    expect(planPartner(input({ snapshot: b({ verified: true }), rows }))).toEqual({ kind: 'exit', reason: 'verified' })
    expect(planPartner(input({ snapshot: b({ docs: [{ type: 'ANTECEDENTES', status: 'PENDING', createdAt: ago(1) }] }), rows }))).toEqual({ kind: 'exit', reason: 'uploaded_docs' })
    expect(planPartner(input({ snapshot: b({}), rows, optedOut: true }))).toEqual({ kind: 'exit', reason: 'opted_out' })
    expect(planPartner(input({ snapshot: b({ excludedFromMarketing: true }), rows }))).toEqual({ kind: 'exit', reason: 'opted_out' })
    expect(planPartner(input({ snapshot: b({ active: false }), rows }))).toEqual({ kind: 'exit', reason: 'inactive' })
  })
  it('A sale al activar un servicio; F/H al enviar una propuesta', () => {
    expect(planPartner(input({ snapshot: snap({ services: [svc('s1')] }), rows: [enrollRow('A', ago(2))] }))).toEqual({ kind: 'exit', reason: 'activated_service' })
    expect(planPartner(input({ snapshot: snap({ verified: true, proposals: 1, lastProposalAt: ago(1) }), rows: [enrollRow('F', ago(2))] }))).toEqual({ kind: 'exit', reason: 'proposal' })
  })
  it('si nos escribió se pausa; retoma tras 5 días de silencio si sigue en el segmento', () => {
    const paused = planPartner(input({ snapshot: b({}), rows, lastInboundAt: ago(1) }))
    expect(paused.kind).toBe('paused')
    const resumed = planPartner(input({ snapshot: b({}), rows: [enrollRow('B', ago(9)), sentRow('docs_wa', ago(9)), sentRow('docs_email', ago(9), 'B', 'email')], lastInboundAt: ago(6) }))
    expect(resumed).toMatchObject({ kind: 'send', step: { key: 'guide_wa' } })
    const changed = planPartner(input({ snapshot: snap({}), rows: [enrollRow('B', ago(9))], lastInboundAt: ago(6) }))
    expect(changed).toEqual({ kind: 'exit', reason: 'segment_changed' })
  })
  it('un mensaje anterior a la inscripción no pausa', () => {
    expect(planPartner(input({ snapshot: b({}), rows: [enrollRow('B', ago(1))], lastInboundAt: ago(3) })).kind).toBe('send')
  })
  it('una salida registrada es definitiva', () => {
    expect(planPartner(input({ rows: [enrollRow('A', ago(3)), { step: 'exit', status: 'exit', segment: 'A', at: ago(1), reason: 'opted_out' }] }))).toEqual({ kind: 'exited' })
  })
})

describe('ritmo', () => {
  it('ventana de lunes a sábado en horas de Bogotá', () => {
    expect(inSendingWindow(NOW, cfg)).toBe(true) // martes 10:00
    expect(inSendingWindow(new Date('2026-11-10T13:59:00Z'), cfg)).toBe(false) // 8:59
    expect(inSendingWindow(new Date('2026-11-11T00:00:00Z'), cfg)).toBe(false) // 19:00
    expect(inSendingWindow(new Date('2026-11-15T15:00:00Z'), cfg)).toBe(false) // domingo
    expect(inSendingWindow(new Date('2026-11-14T15:00:00Z'), cfg)).toBe(true) // sábado
  })
  it('inicio del día de Bogotá', () => {
    expect(bogotaDayStart(new Date('2026-11-11T03:00:00Z')).toISOString()).toBe('2026-11-10T05:00:00.000Z')
  })
  it('primero B con servicios escasos, luego los más antiguos', () => {
    const rows = [
      { id: 'f', segment: 'F' as const, createdAt: ago(300), scarcity: 999 },
      { id: 'b-many', segment: 'B' as const, createdAt: ago(400), scarcity: 9 },
      { id: 'b-few', segment: 'B' as const, createdAt: ago(100), scarcity: 1 },
      { id: 'a', segment: 'A' as const, createdAt: ago(500), scarcity: 999 },
    ]
    expect(enrollmentOrder(rows).map((r) => r.id)).toEqual(['b-few', 'b-many', 'a', 'f'])
  })
})

describe('textos', () => {
  it('SMS de máximo 160 caracteres', () => {
    expect(smsText('Ana María').length).toBeLessThanOrEqual(160)
    expect(smsText('Maximiliano-Alejandro').length).toBeLessThanOrEqual(160)
    expect(smsText('Ana')).toContain('Ana, tu perfil')
    expect(smsText('Ana')).toContain('BAJA')
    expect(smsText('María Peña')).toMatch(/^[\x20-\x7E]+$/)
  })
  it('A dice «tus servicios»; B nombra los suyos', () => {
    expect(serviceTextFor('A', [])).toBe('tus servicios')
    expect(serviceTextFor('B', [svc('s1'), svc('s2')])).toBe('Pintura y Plomería')
  })
})

describe('demanda', () => {
  const rows = [
    { serviceId: 's1', name: 'Pintura', city: 'MEDELLIN', requests: 6, unmet: 2, verifiedPartners: 8 },
    { serviceId: 's2', name: 'Plomería', city: 'MEDELLIN', requests: 3, unmet: 0, verifiedPartners: 1 },
    { serviceId: 's3', name: 'Aseo', city: 'MEDELLIN', requests: 2, unmet: 0, verifiedPartners: 12 },
    { serviceId: 's4', name: 'Pintura', city: 'BOGOTA', requests: 9, unmet: 9, verifiedPartners: 0 },
  ]
  it('solo de la ciudad, primero la demanda sin atender', () => {
    expect(rankDemand(rows, 'MEDELLIN').map((r) => r.serviceId)).toEqual(['s1', 's2', 's3'])
  })
  it('C29 honesto: sin atender o pocos socios, y solo sus servicios', () => {
    expect(rankDemand(rows, 'MEDELLIN', { fewPartners: 3 }).map((r) => r.serviceId)).toEqual(['s1', 's2'])
    expect(rankDemand(rows, 'MEDELLIN', { only: ['s3'], fewPartners: 3 })).toEqual([])
  })
})

describe('historial y reporte', () => {
  it('lee los detalles guardados', () => {
    const at = ago(1)
    expect(parseRxDetails(JSON.stringify({ step: 'enroll', status: 'enrolled', segment: 'B', control: true }), at)).toMatchObject({ step: 'enroll', control: true, at })
    expect(parseRxDetails('no-json', at)).toBeNull()
  })
  it('compara campaña y control dentro de la ventana', () => {
    const enrollments = [
      { userId: 't1', at: ago(20), segment: 'B' as const, control: false, activeServices: 1 },
      { userId: 't2', at: ago(20), segment: 'B' as const, control: false, activeServices: 1 },
      { userId: 'c1', at: ago(20), segment: 'B' as const, control: true, activeServices: 1 },
    ]
    const events = (id: string) => ({
      docs: id === 't1' ? [ago(18)] : id === 't2' ? [ago(1)] : [],
      verified: [], services: [], firstProposalAt: null, firstBookingAt: null,
      inbound: id === 'c1' ? [ago(19)] : [],
    })
    const b = conversionReport(enrollments, events, 14).find((r) => r.segment === 'B')!
    expect(b.treatment).toMatchObject({ n: 2, docs: 1, replied: 0 })
    expect(b.control).toMatchObject({ n: 1, docs: 0, replied: 1 })
  })
})

describe('tope de servicios al aprobar la cédula', () => {
  it('activa los más recientes hasta completar el tope, sin apagar los activos', () => {
    const s = (id: string, active: boolean, days: number) => ({ id, active, createdAt: ago(days) })
    expect(servicesToActivate([s('a', true, 50), s('b', false, 40), s('c', false, 10), s('d', false, 30)], 3)).toEqual(['c', 'd'])
    expect(servicesToActivate([s('a', true, 1), s('b', true, 2), s('c', false, 3)], 2)).toEqual([])
    expect(servicesToActivate(Array.from({ length: 8 }, (_, i) => s(`x${i}`, false, i)), 5)).toHaveLength(5)
  })
})
