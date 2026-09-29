import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  service: { findMany: vi.fn() },
  conversation: { findUnique: vi.fn() },
  conversationMessage: { findFirst: vi.fn() },
  proposal: { findFirst: vi.fn() },
  serviceRequest: { findFirst: vi.fn() },
  aiAgentAction: { findUnique: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

const actions = vi.hoisted(() => ({
  recordAction: vi.fn(async (p: unknown) => ({ id: 'a1', ...(p as object) })),
  settleAction: vi.fn(async () => ({})),
  latestProposed: vi.fn(async () => null as null | { id: string; createdAt: Date }),
  proposedInWindow: vi.fn(async (..._a: unknown[]) => [] as Array<{ id: string; createdAt: Date; input: unknown }>),
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
vi.mock('@/lib/bookings/ops', () => ({ bookingsFor: ops.bookingsFor, bookingSummaryForChat: ops.bookingSummaryForChat, transitionBooking: ops.transitionBooking, rescheduleBooking: ops.rescheduleBooking, bookingWhen: (b: { scheduledDate: Date }) => new Date(b.scheduledDate) }))
const guarantee = vi.hoisted(() => ({ openGuaranteeClaim: vi.fn(async (_a: unknown, i: { type: string }) => ({ id: 'gc_00claim', type: i.type, slaDueAt: new Date(Date.now() + 72 * 3600_000) })) }))
vi.mock('@/lib/guarantee/ops', () => guarantee)
vi.mock('@/lib/partners/ops', () => ({ setAvailability: ops.setAvailability, addBankAccount: vi.fn(), fetchAttachmentForDocument: vi.fn(), partnerByUser: vi.fn(), partnerStatusSummary: vi.fn(), uploadDocument: vi.fn(), upsertPartnerService: vi.fn() }))
const requests = vi.hoisted(() => ({
  listClientRequests: vi.fn(async () => ({ serviceRequests: [] as Array<Record<string, unknown>> })),
  listOpenRequestsForPartner: vi.fn(async () => [] as Array<Record<string, unknown>>),
  reactivateServiceRequest: vi.fn(async () => ({ id: 'sr_00exp1', expiresAt: new Date('2026-10-03T15:00:00Z'), reactivations: 1, remaining: 2, restoredProposals: 1 })),
}))
vi.mock('@/lib/service-requests/ops', () => ({
  cancelServiceRequest: vi.fn(), createServiceRequest: vi.fn(), listClientRequests: requests.listClientRequests, listOpenRequestsForPartner: requests.listOpenRequestsForPartner, partnerAvailabilitySummary: vi.fn(), partnersForService: vi.fn(), requestSummaryForChat: vi.fn(),
  reactivateServiceRequest: requests.reactivateServiceRequest,
  isRequestExpired: (r: { status: string; expiresAt: Date }) => r.status === 'EXPIRED' || (r.status === 'ACTIVE' && new Date(r.expiresAt).getTime() < Date.now()),
}))
vi.mock('@/lib/payments/ops', () => ({ confirmPartnerPayment: vi.fn(), mercadoPagoLinkFor: vi.fn(), paymentSummaryForChat: vi.fn(() => 'Pago: pendiente'), rejectPartnerPayment: vi.fn(), reportClientPayment: vi.fn() }))
vi.mock('@/lib/reviews/ops', () => ({ leaveReview: vi.fn() }))
vi.mock('@/lib/accounts/link', () => ({ confirmLink: vi.fn(), startLink: vi.fn() }))
const photos = vi.hoisted(() => ({ storeChatPhotos: vi.fn(async (urls: string[]) => ({ urls: urls.map((u) => u.replace('https://media.x/', 'https://res.cloudinary.com/x/')), failed: 0 })), recentInboundPhotos: vi.fn(async () => []), CHAT_PHOTO_WINDOW_MS: 86_400_000 }))
vi.mock('@/lib/chat/photos', () => photos)
const chatOps = vi.hoisted(() => ({
  resolveChatByRef: vi.fn(async () => ({ id: 'chat1', clientId: 'u1', partnerId: 'pp1', proposalId: 'prop_00xyz1', client: { name: 'Ana' }, partner: { user: { name: 'Darwin' } }, serviceRequest: { service: { name: 'Plomería' } }, proposal: { id: 'prop_00xyz1', bookings: [{ id: 'bk_000abc' }] } })),
  sendChatMessage: vi.fn(async () => ({ blocked: false, message: { id: 'm1' }, helpReply: null, delivery: 'whatsapp' })),
  takeUnreadMessages: vi.fn(async () => []),
  chatRef: () => '000abc',
  CHAT_MESSAGE_MAX: 5000,
  PHOTO_ONLY_TEXT: '📷 Foto',
}))
vi.mock('@/lib/chat/ops', () => chatOps)
const login = vi.hoisted(() => ({ sendLoginLinkFromChat: vi.fn(), LOGIN_LINK_TTL_MIN: 60 }))
vi.mock('@/lib/accounts/login-link', () => login)

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
  actions.proposedInWindow.mockImplementation(async (...a: unknown[]) => {
    const p = await (actions.latestProposed as unknown as (...x: unknown[]) => Promise<unknown>)(...a)
    return (p ? [p] : []) as never
  })
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
    const out = await runPlatformTool('cancelar_reserva', { reserva_ref: '000abc', motivo: 'Me surgió un viaje', confirmado: false }, c)
    expect(out).toMatch(/máximo de veces/)
    expect(c.state.handoff).not.toBeNull()
    expect(ops.transitionBooking).not.toHaveBeenCalled()
  })
  it('sin motivo suficiente pide el motivo antes de proponer (no falla después del sí)', async () => {
    const out = await runPlatformTool('cancelar_reserva', { reserva_ref: '000abc', motivo: 'ya', confirmado: false }, ctx())
    expect(out).toMatch(/Falta el motivo/)
    expect(actions.recordAction).not.toHaveBeenCalled()
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
    expect(out).toMatch(/simulado en pruebas/i)
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

describe('runPlatformTool · garantía (reportar_problema_servicio)', () => {
  const past = { id: 'bk_000abc', userId: 'u1', partnerId: 'p1', status: 'CONFIRMED', totalPrice: 130000, scheduledDate: new Date(Date.now() - 2 * 3600_000), scheduledTime: '10:00', updatedAt: new Date(), service: { name: 'Plomería' } }
  const input = (over: Record<string, unknown> = {}) => ({ reserva_ref: '000abc', tipo: 'no_llego', descripcion: 'El socio no llegó a las 10 y no avisó', confirmado: false, ...over })

  it('primero propone: resume el reclamo y no abre nada', async () => {
    ops.bookingsFor.mockResolvedValueOnce([past] as never)
    const out = await runPlatformTool('reportar_problema_servicio', input(), ctx())
    expect(out).toMatch(/pendiente de confirmación/i)
    expect(out).toMatch(/el socio no llegó/)
    expect(guarantee.openGuaranteeClaim).not.toHaveBeenCalled()
    expect(actions.recordAction).toHaveBeenCalledWith(expect.objectContaining({ tool: 'reportar_problema_servicio', status: 'proposed' }))
  })

  it('con el sí abre el reclamo con origen chat y la última foto; un daño traspasa a una persona', async () => {
    ops.bookingsFor.mockResolvedValueOnce([{ ...past, status: 'IN_PROGRESS' }] as never)
    db.conversationMessage.findFirst.mockResolvedValueOnce({ mediaUrl: 'https://media.x/foto.jpg' })
    const i = input({ tipo: 'dano', descripcion: 'Rompió el lavamanos al desmontarlo', confirmado: true })
    actions.latestProposed.mockResolvedValue({ id: 'prop-g', createdAt: new Date(Date.now() - 60_000), input: { ...i, confirmado: false } } as never)
    const c = ctx()
    const out = await runPlatformTool('reportar_problema_servicio', i, c)
    const [actor, claimInput, origin] = guarantee.openGuaranteeClaim.mock.calls[0] as unknown as [{ userId: string }, { bookingId: string; type: string; photoUrls: string[] }, { via: string; conversationId: string }]
    expect(actor.userId).toBe('u1')
    expect(photos.storeChatPhotos).toHaveBeenCalledWith(['https://media.x/foto.jpg'], 'lohaggo/guarantee')
    expect(claimInput).toMatchObject({ bookingId: 'bk_000abc', type: 'DAMAGE', photoUrls: ['https://res.cloudinary.com/x/foto.jpg'] })
    expect(origin).toMatchObject({ via: 'chat', conversationId: 'conv1' })
    expect(c.state.handoff).not.toBeNull()
    expect(out).toMatch(/Reclamo de garantía registrado/)
    expect(out).not.toMatch(/te devolvemos|reembolsamos/i)
    expect(actions.settleAction).toHaveBeenCalledWith('prop-g', expect.objectContaining({ status: 'executed', entityType: 'GuaranteeClaim' }))
  })

  it('fuera de la política no propone: todavía no es la hora del servicio', async () => {
    ops.bookingsFor.mockResolvedValueOnce([{ ...past, scheduledDate: new Date(Date.now() + 5 * 3600_000) }] as never)
    const out = await runPlatformTool('reportar_problema_servicio', input(), ctx())
    expect(out).toMatch(/No aplica la garantía/)
    expect(actions.recordAction).not.toHaveBeenCalled()
  })

  it('el socio de la reserva no puede reclamar la garantía', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u2', role: 'PARTNER', email: 'd@x.com', isActive: true, partnerProfile: { id: 'p1' } })
    ops.bookingsFor.mockResolvedValueOnce([past] as never)
    const out = await runPlatformTool('reportar_problema_servicio', input(), ctx({ userId: 'u2' }))
    expect(out).toMatch(/Solo el cliente/)
    expect(guarantee.openGuaranteeClaim).not.toHaveBeenCalled()
  })
})

describe('runPlatformTool · reactivar_solicitud (botón «Reactivar» de la plantilla)', () => {
  it('reactiva la solicitud vencida de la referencia sin pedir confirmación, con origen chat', async () => {
    requests.listClientRequests.mockResolvedValue({ serviceRequests: [{ id: 'sr_00exp1', status: 'EXPIRED', expiresAt: new Date(Date.now() - 3600_000), service: { name: 'Plomería' } }] })
    const out = await runPlatformTool('reactivar_solicitud', { solicitud_ref: '00exp1' }, ctx())
    expect(requests.reactivateServiceRequest).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), 'sr_00exp1', expect.objectContaining({ via: 'chat', conversationId: 'conv1' }))
    expect(out).toContain('Solicitud reactivada')
    expect(actions.recordAction).toHaveBeenCalledWith(expect.objectContaining({ tool: 'reactivar_solicitud', status: 'executed' }))
  })

  it('una solicitud activa no se reactiva', async () => {
    requests.listClientRequests.mockResolvedValue({ serviceRequests: [{ id: 'sr_00act1', status: 'ACTIVE', expiresAt: new Date(Date.now() + 3600_000), service: { name: 'Plomería' } }] })
    const out = await runPlatformTool('reactivar_solicitud', { solicitud_ref: '00act1' }, ctx())
    expect(out).toMatch(/sigue activa/)
    expect(requests.reactivateServiceRequest).not.toHaveBeenCalled()
  })
})

describe('runPlatformTool · chat de la reserva', () => {
  it('propone el mensaje al socio y con el sí lo envía al chat con origen chat', async () => {
    const i = { ref: '000abc', mensaje: 'Llego a las 9, ¿puede traer escalera?', incluir_fotos: false, confirmado: false }
    const first = await runPlatformTool('enviar_mensaje_reserva', i, ctx())
    expect(first).toMatch(/pendiente de confirmación/i)
    expect(first).toContain('Darwin')
    expect(chatOps.sendChatMessage).not.toHaveBeenCalled()
    actions.latestProposed.mockResolvedValue({ id: 'prop-m', createdAt: new Date(Date.now() - 60_000), input: i } as never)
    const out = await runPlatformTool('enviar_mensaje_reserva', { ...i, confirmado: true }, ctx())
    expect(chatOps.sendChatMessage).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), 'chat1', { content: i.mensaje, imageUrl: null }, expect.objectContaining({ via: 'chat', conversationId: 'conv1' }))
    expect(out).toMatch(/le llegó por WhatsApp/)
  })
  it('no propone mensajes con datos de contacto', async () => {
    const out = await runPlatformTool('enviar_mensaje_reserva', { ref: '000abc', mensaje: 'escríbeme al 3001234567', incluir_fotos: false, confirmado: false }, ctx())
    expect(out).toMatch(/datos de contacto/)
    expect(actions.recordAction).not.toHaveBeenCalled()
  })
})

describe('runPlatformTool · enlace de acceso', () => {
  it('sin vincular: la respuesta no dice si la cuenta existe y nunca trae el enlace', async () => {
    db.conversation.findUnique.mockResolvedValueOnce({ contactId: 'ct1', userId: null, workspaceId: 'ws' })
    login.sendLoginLinkFromChat.mockResolvedValueOnce({ ok: true, sentTo: 'a•••@x.com' })
    const out = await runPlatformTool('enviar_enlace_acceso', { dato: 'ana@x.com' }, ctx({ userId: null }))
    expect(login.sendLoginLinkFromChat).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv1', userId: null, given: 'ana@x.com' }))
    expect(out).toMatch(/Si esos datos corresponden a una cuenta/)
    expect(out).not.toMatch(/auth\/magic|token=/)
  })
  it('vinculada: usa la cuenta de la conversación, no el dato que escriba el modelo', async () => {
    db.conversation.findUnique.mockResolvedValueOnce({ contactId: 'ct1', userId: 'u1', workspaceId: 'ws' })
    login.sendLoginLinkFromChat.mockResolvedValueOnce({ ok: true, sentTo: 'a•••@x.com' })
    const out = await runPlatformTool('enviar_enlace_acceso', { dato: 'otra@persona.com' }, ctx())
    expect(login.sendLoginLinkFromChat).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }))
    expect(out).toMatch(/Enlace enviado al correo a•••@x.com/)
  })
})

describe('runPlatformTool · varias propuestas abiertas a la vez', () => {
  it('con «Si» cada mensaje confirma su propia propuesta (el caso de los tres socios)', async () => {
    const msg = 'Por favor, miren en mi solicitud las fotos'
    const props = ['93seye', '9u3xt5', 'opvh6i'].map((ref, i) => ({ id: `p-${ref}`, createdAt: new Date(Date.now() - 60_000 - i), input: { ref, mensaje: msg, incluir_fotos: false, confirmado: false } }))
    actions.proposedInWindow.mockResolvedValue(props as never)
    const turn = ctx({ personText: 'Si', turnStartedAt: new Date() })
    for (const ref of ['93seye', '9u3xt5', 'opvh6i']) {
      await runPlatformTool('enviar_mensaje_reserva', { ref, mensaje: msg, incluir_fotos: false, confirmado: false }, turn)
    }
    expect(chatOps.sendChatMessage).toHaveBeenCalledTimes(3)
    for (const ref of ['93seye', '9u3xt5', 'opvh6i']) expect(actions.settleAction).toHaveBeenCalledWith(`p-${ref}`, expect.objectContaining({ status: 'executed' }))
    expect(actions.recordAction).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'proposed' }))
  })
})

describe('runPlatformTool · socio que propone por el chat', () => {
  const partner = () => db.user.findUnique.mockResolvedValue({ id: 'u9', role: 'PARTNER', email: 'c@x.com', isActive: true, partnerProfile: { id: 'pp9' } })
  it('la referencia en mayúsculas del aviso (#HOPMJV) encuentra la solicitud', async () => {
    partner()
    requests.listOpenRequestsForPartner.mockResolvedValueOnce([{ id: 'cmulot7tt00pi1g89idhopmjv', service: { name: 'Pintura' } }])
    const out = await runPlatformTool('enviar_propuesta', { solicitud_ref: '#HOPMJV', precio: 1800000, nota: '', fecha: '', hora: '', confirmado: false }, ctx())
    expect(out).toMatch(/pendiente de confirmación/i)
    expect(out).toContain('Pintura')
  })
  it('si ya propuso, lo dice (en vez de «no está abierta») y ofrece escribirle al cliente', async () => {
    partner()
    requests.listOpenRequestsForPartner.mockResolvedValueOnce([])
    db.proposal.findFirst.mockResolvedValueOnce({ id: 'cmulpddaw000bs074il852rbp', price: 1500000, status: 'PENDING', createdAt: new Date(), serviceRequest: { service: { name: 'Pintura' } } })
    const out = await runPlatformTool('enviar_propuesta', { solicitud_ref: 'HOPMJV', precio: 1800000, nota: '', fecha: '', hora: '', confirmado: false }, ctx())
    expect(out).toMatch(/ya envió una propuesta/)
    expect(out).toContain('enviar_mensaje_reserva')
    expect(db.proposal.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { partnerId: 'pp9', serviceRequestId: { endsWith: 'hopmjv' } } }))
  })
})
