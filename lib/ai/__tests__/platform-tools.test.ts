import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  service: { findMany: vi.fn() },
  conversation: { findUnique: vi.fn() },
  conversationMessage: { findFirst: vi.fn() },
  aiAgentAction: { findUnique: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

const actions = vi.hoisted(() => ({
  recordAction: vi.fn(async (p: unknown) => ({ id: 'a1', ...(p as object) })),
  settleAction: vi.fn(async () => ({})),
  latestProposed: vi.fn(async () => null as null | { id: string; createdAt: Date }),
  expireStaleProposals: vi.fn(async () => undefined),
  overDailyLimit: vi.fn(async () => false),
  leaveTrail: vi.fn(async () => undefined),
}))
vi.mock('@/lib/ai/actions', () => actions)

const ops = vi.hoisted(() => ({
  acceptProposal: vi.fn(async () => ({ id: 'bk_000abc', status: 'PENDING', service: { name: 'Plomería' } })),
  listProposalsForClient: vi.fn(async () => [{ id: 'prop_00xyz1', status: 'PENDING', price: 130000, partner: { user: { name: 'Darwin' } } }]),
  createProposal: vi.fn(),
  proposalSummaryForChat: vi.fn(() => 'Darwin · $130.000'),
  bookingsFor: vi.fn(async () => [{ id: 'bk_000abc', status: 'CONFIRMED', totalPrice: 130000, service: { name: 'Plomería' } }]),
  bookingSummaryForChat: vi.fn(() => 'Reserva'),
  transitionBooking: vi.fn(async () => ({ id: 'bk_000abc', status: 'CANCELLED' })),
  rescheduleBooking: vi.fn(),
  setAvailability: vi.fn(async () => ({ previous: true })),
}))
vi.mock('@/lib/proposals/ops', () => ({ acceptProposal: ops.acceptProposal, createProposal: ops.createProposal, listProposalsForClient: ops.listProposalsForClient, proposalSummaryForChat: ops.proposalSummaryForChat }))
vi.mock('@/lib/bookings/ops', () => ({ bookingsFor: ops.bookingsFor, bookingSummaryForChat: ops.bookingSummaryForChat, transitionBooking: ops.transitionBooking, rescheduleBooking: ops.rescheduleBooking }))
vi.mock('@/lib/partners/ops', () => ({ setAvailability: ops.setAvailability, addBankAccount: vi.fn(), fetchAttachmentForDocument: vi.fn(), partnerByUser: vi.fn(), partnerStatusSummary: vi.fn(), uploadDocument: vi.fn(), upsertPartnerService: vi.fn() }))
vi.mock('@/lib/service-requests/ops', () => ({ cancelServiceRequest: vi.fn(), createServiceRequest: vi.fn(), listClientRequests: vi.fn(), listOpenRequestsForPartner: vi.fn(), partnerAvailabilitySummary: vi.fn(), partnersForService: vi.fn(), requestSummaryForChat: vi.fn() }))
vi.mock('@/lib/payments/ops', () => ({ confirmPartnerPayment: vi.fn(), mercadoPagoLinkFor: vi.fn(), paymentSummaryForChat: vi.fn(() => 'Pago: pendiente'), rejectPartnerPayment: vi.fn(), reportClientPayment: vi.fn() }))
vi.mock('@/lib/reviews/ops', () => ({ leaveReview: vi.fn() }))
vi.mock('@/lib/accounts/link', () => ({ confirmLink: vi.fn(), startLink: vi.fn() }))

import { runPlatformTool } from '@/lib/ai/platform-tools'
import type { ToolContext } from '@/lib/ai/tools'

const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({
  agent: { id: 'ag1', name: 'Sofía', tools: [], crmModules: [], webhookUrl: null },
  workspaceId: 'ws', conversationId: 'conv1', userId: 'u1',
  contact: { name: 'Ana', phone: '+573001112233', channel: 'WHATSAPP' },
  dryRun: false, mode: 'autopilot', state: { handoff: null, chosenOutput: null, chunks: [] },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  db.user.findUnique.mockResolvedValue({ id: 'u1', role: 'CLIENT', email: 'ana@x.com', isActive: true, partnerProfile: null })
  actions.latestProposed.mockResolvedValue(null)
  actions.overDailyLimit.mockResolvedValue(false)
})

describe('runPlatformTool · autopilot confirmation flow', () => {
  it('first call proposes: nothing runs, the proposal is recorded and the agent is told to ask', async () => {
    const out = await runPlatformTool('aceptar_propuesta', { propuesta_ref: '00xyz1', fecha: '', hora: '', confirmado: false }, ctx())
    expect(out).toMatch(/pendiente de confirmación/i)
    expect(out).toContain('Darwin')
    expect(ops.acceptProposal).not.toHaveBeenCalled()
    expect(actions.recordAction).toHaveBeenCalledWith(expect.objectContaining({ tool: 'aceptar_propuesta', status: 'proposed' }))
  })

  it('a yes without a recent proposal is stale and does not run', async () => {
    const out = await runPlatformTool('aceptar_propuesta', { propuesta_ref: '00xyz1', fecha: '', hora: '', confirmado: true }, ctx())
    expect(out).toMatch(/No hay una acción propuesta reciente/)
    expect(ops.acceptProposal).not.toHaveBeenCalled()
  })

  it('a yes after a recent proposal runs through the shared op with chat origin and leaves the trail', async () => {
    actions.latestProposed.mockResolvedValue({ id: 'prop-action', createdAt: new Date(Date.now() - 60_000), input: { propuesta_ref: '00xyz1', fecha: '', hora: '', confirmado: false } } as never)
    const out = await runPlatformTool('aceptar_propuesta', { propuesta_ref: '00xyz1', fecha: '', hora: '', confirmado: true }, ctx())
    expect(ops.acceptProposal).toHaveBeenCalledTimes(1)
    const [actor, proposalId, origin] = ops.acceptProposal.mock.calls[0] as unknown as [unknown, string, { via: string; channel: string; conversationId: string; agentId: string }]
    expect(actor).toMatchObject({ userId: 'u1', role: 'CLIENT' })
    expect(proposalId).toBe('prop_00xyz1')
    expect(origin).toMatchObject({ via: 'chat', channel: 'WHATSAPP', conversationId: 'conv1', agentId: 'ag1' })
    expect(actions.settleAction).toHaveBeenCalledWith('prop-action', expect.objectContaining({ status: 'executed', entityType: 'Booking', entityId: 'bk_000abc' }))
    expect(actions.leaveTrail).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'Booking', entityId: 'bk_000abc' }))
    expect(out).toMatch(/Propuesta aceptada/)
  })

  it('a reference outside the person’s own records is refused before anything is proposed', async () => {
    const out = await runPlatformTool('aceptar_propuesta', { propuesta_ref: 'zzzzzz', fecha: '', hora: '', confirmado: false }, ctx())
    expect(out).toMatch(/no corresponde/)
    expect(actions.recordAction).not.toHaveBeenCalled()
  })

  it('over the daily limit: nothing runs and the conversation is handed off', async () => {
    actions.overDailyLimit.mockResolvedValue(true)
    const c = ctx()
    const out = await runPlatformTool('cancelar_reserva', { reserva_ref: '000abc', motivo: 'x', confirmado: false }, c)
    expect(out).toMatch(/máximo de veces/)
    expect(c.state.handoff).not.toBeNull()
    expect(ops.transitionBooking).not.toHaveBeenCalled()
  })
})

describe('runPlatformTool · modes and scope', () => {
  it('not linked: no account tools run', async () => {
    const out = await runPlatformTool('ver_mis_reservas', { solo_proximas: false }, ctx({ userId: null }))
    expect(out).toMatch(/no está vinculada/)
    expect(ops.bookingsFor).not.toHaveBeenCalled()
  })

  it('playground writes nothing and says what would be recorded', async () => {
    const out = await runPlatformTool('cancelar_reserva', { reserva_ref: '000abc', motivo: 'viaje', confirmado: true }, ctx({ mode: 'playground', dryRun: true, conversationId: null }))
    expect(out).toMatch(/Simulado en pruebas/)
    expect(out).toMatch(/origen «chat»/)
    expect(ops.transitionBooking).not.toHaveBeenCalled()
    expect(actions.recordAction).not.toHaveBeenCalled()
  })

  it('copilot records an action awaiting a person’s approval instead of running', async () => {
    const out = await runPlatformTool('cancelar_reserva', { reserva_ref: '000abc', motivo: 'viaje', confirmado: true }, ctx({ mode: 'copilot', dryRun: true }))
    expect(out).toMatch(/apruebe desde la bandeja/)
    expect(actions.recordAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'awaiting_approval', tool: 'cancelar_reserva' }))
    expect(ops.transitionBooking).not.toHaveBeenCalled()
  })

  it('partner-only tools refuse a client', async () => {
    const out = await runPlatformTool('cambiar_disponibilidad', { disponible: false }, ctx())
    expect(out).toMatch(/solo para socios/)
    expect(ops.setAvailability).not.toHaveBeenCalled()
  })

  it('availability toggles right away for a partner (no confirmation) and is recorded as executed', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u2', role: 'PARTNER', email: 'd@x.com', isActive: true, partnerProfile: { id: 'pp1' } })
    const out = await runPlatformTool('cambiar_disponibilidad', { disponible: false }, ctx({ userId: 'u2' }))
    expect(ops.setAvailability).toHaveBeenCalledWith(expect.objectContaining({ partnerId: 'pp1' }), false, expect.objectContaining({ via: 'chat' }))
    expect(actions.recordAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'executed', entityType: 'PartnerProfile', entityId: 'pp1' }))
    expect(out).toMatch(/no disponible/)
  })
})

describe('runPlatformTool · the yes must match the proposal', () => {
  it('a confirmation with other data than what was proposed does not run', async () => {
    actions.latestProposed.mockResolvedValue({ id: 'prop-action', createdAt: new Date(Date.now() - 60_000), input: { reserva_ref: '000abc', motivo: 'otro', confirmado: false } } as never)
    const out = await runPlatformTool('cancelar_reserva', { reserva_ref: '000abc', motivo: 'viaje', confirmado: true }, ctx())
    expect(out).toMatch(/no coincide/)
    expect(ops.transitionBooking).not.toHaveBeenCalled()
    expect(actions.settleAction).toHaveBeenCalledWith('prop-action', expect.objectContaining({ status: 'expired' }))
  })
})

describe('runPlatformTool · playground linking', () => {
  it('a simulated code links the pretend client so the rest of the flow can be tried', async () => {
    const c = ctx({ mode: 'playground', dryRun: true, conversationId: null, userId: null })
    expect(await runPlatformTool('confirmar_codigo', { codigo: 'abc' }, c)).toMatch(/incorrecto/)
    expect(await runPlatformTool('confirmar_codigo', { codigo: '482913' }, c)).toMatch(/vinculada/)
    expect(c.userId).toBe('__playground__')
    db.service.findMany.mockResolvedValue([{ id: 's1', name: 'Plomería', basePrice: 100000, slug: 'plomeria' }])
    const out = await runPlatformTool('crear_solicitud', { servicio: 'Plomería', direccion: 'Calle 10 #43-20', ciudad: 'Medellín', fecha: '', hora: '', urgente: true, detalles: 'fuga', presupuesto: 0, socio_ref: '', confirmado: false }, c)
    expect(out).toMatch(/Simulado en pruebas: Crear solicitud de Plomería/)
    expect(actions.recordAction).not.toHaveBeenCalled()
  })
})
