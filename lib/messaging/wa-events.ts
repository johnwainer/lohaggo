/**
 * Each platform event → its WhatsApp template (lib/messaging/wa-specs.ts), to the right person. Loads what
 * the variables need, never throws and never blocks the operation that called it. The shared ops
 * (lib/*\/ops.ts), the admin routes and the crons call these.
 *
 * Rule for the person who acted from the chat: they already read the answer there, so the template that
 * would only tell them what they just did is not sent (origin.via === 'chat').
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { bookingWhen } from '@/lib/bookings/when'
import { WA } from '@/lib/messaging/wa-specs'
import { deliverWa, sendWaToAdmins, sendWaToUser, type WaOutcome } from '@/lib/messaging/wa-send'
import { toE164 } from '@/lib/inbox/contacts'

const logger = createLogger('wa-events')

type OriginLike = { via: string } | null | undefined
const fromChat = (o: OriginLike) => o?.via === 'chat'

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    logger.warn(`WhatsApp event ${label} failed (non-fatal)`, { err: err instanceof Error ? err.message : err })
    return null
  }
}

const BOOKING_SELECT = {
  id: true, userId: true, partnerId: true, status: true, scheduledDate: true, scheduledTime: true, totalPrice: true, address: true, city: true, proposalId: true,
  service: { select: { name: true } },
  user: { select: { id: true, name: true } },
  partner: { select: { id: true, userId: true, user: { select: { id: true, name: true } } } },
} as const

async function loadBooking(bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: BOOKING_SELECT })
  if (!b) return null
  return {
    row: b,
    data: {
      id: b.id, when: bookingWhen(b), service: b.service?.name ?? 'tu servicio', price: b.totalPrice,
      clientName: b.user?.name ?? null, partnerName: b.partner?.user?.name ?? null, address: b.address, city: b.city,
    },
  }
}

// ─── Requests and proposals ─────────────────────────────────────────────────

/** C10 / C11 to one partner (called inside notifyNewServiceRequest). `round` > 0 on resends and reactivations. */
export function waNewRequestToPartner(p: { requestId: string; partnerUserId: string; partnerName: string; service: string; address: string | null; city: string; when: string; direct: boolean; round?: number }) {
  return safe('C10', () => sendWaToUser(p.partnerUserId, WA.C10(p)))
}

/** Legacy «solicitud enviada» to the client (approved UTILITY) unless they asked from the chat. */
export function waRequestCreated(p: { requestId: string; clientUserId: string; clientName: string; service: string; origin?: OriginLike }) {
  if (fromChat(p.origin)) return Promise.resolve(null)
  return safe('solicitud_enviada', () => sendWaToUser(p.clientUserId, WA.solicitudEnviada(p)))
}

/** B26 / C31: the other party wrote in the booking chat and this person's WhatsApp window is closed. */
export function waChatMessage(p: { chatId: string; recipientUserId: string; recipientSide: 'CLIENT' | 'PARTNER'; senderName: string; service: string; ref: string }) {
  return safe(p.recipientSide === 'CLIENT' ? 'B26' : 'C31', async () => {
    const u = await prisma.user.findUnique({ where: { id: p.recipientUserId }, select: { name: true } })
    const spec = p.recipientSide === 'CLIENT'
      ? WA.B26({ chatId: p.chatId, clientName: u?.name ?? '', partnerName: p.senderName, service: p.service, ref: p.ref })
      : WA.C31({ chatId: p.chatId, partnerName: u?.name ?? '', clientName: p.senderName, service: p.service, ref: p.ref })
    return sendWaToUser(p.recipientUserId, spec)
  })
}

/** B3: a partner sent a proposal. */
export function waNewProposal(proposalId: string) {
  return safe('B3', async () => {
    const p = await prisma.proposal.findUnique({ where: { id: proposalId }, select: { id: true, price: true, partner: { select: { user: { select: { name: true } } } }, serviceRequest: { select: { userId: true, user: { select: { name: true } }, service: { select: { name: true } } } } } })
    if (!p) return null
    return sendWaToUser(p.serviceRequest.userId, WA.B3({ proposalId: p.id, clientName: p.serviceRequest.user.name, service: p.serviceRequest.service.name, price: Number(p.price), partnerName: p.partner.user.name }))
  })
}

async function loadRequest(requestId: string) {
  return prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { id: true, userId: true, address: true, city: true, createdAt: true, expiresAt: true, user: { select: { name: true } }, service: { select: { name: true } }, _count: { select: { proposals: true } } } })
}

/** B4: 2 h without proposals (after the resend round). */
export function waRequestNoProposals(requestId: string) {
  return safe('B4', async () => {
    const r = await loadRequest(requestId)
    if (!r) return null
    return sendWaToUser(r.userId, WA.B4({ requestId: r.id, clientName: r.user.name, service: r.service.name }))
  })
}

/** B5: expires in 1-2 h. */
export function waRequestExpiring(requestId: string, now = new Date()) {
  return safe('B5', async () => {
    const r = await loadRequest(requestId)
    if (!r) return null
    return sendWaToUser(r.userId, WA.B5({ requestId: r.id, clientName: r.user.name, service: r.service.name, expiresAt: r.expiresAt, proposals: r._count.proposals, now }), now)
  })
}

/** B6: the request expired. */
export function waRequestExpired(requestId: string) {
  return safe('B6', async () => {
    const r = await loadRequest(requestId)
    if (!r) return null
    return sendWaToUser(r.userId, WA.B6({ requestId: r.id, clientName: r.user.name, service: r.service.name }))
  })
}

/** B7: the client cancelled the request (not from the chat). */
export function waRequestCancelled(requestId: string, origin?: OriginLike) {
  if (fromChat(origin)) return Promise.resolve(null)
  return safe('B7', async () => {
    const r = await loadRequest(requestId)
    if (!r) return null
    return sendWaToUser(r.userId, WA.B7({ requestId: r.id, clientName: r.user.name, service: r.service.name }))
  })
}

/** B8 to the client (not from the chat) and C12 to the partner: a proposal was accepted. */
export function waProposalAccepted(bookingId: string, origin?: OriginLike) {
  return safe('B8/C12', async () => {
    const b = await loadBooking(bookingId)
    if (!b) return null
    if (!fromChat(origin)) await sendWaToUser(b.row.userId, WA.B8(b.data))
    if (b.row.partner?.userId) await sendWaToUser(b.row.partner.userId, WA.C12(b.data))
    return true
  })
}

/** C13: the client chose another proposal. */
export function waProposalNotChosen(proposalId: string) {
  return safe('C13', async () => {
    const p = await prisma.proposal.findUnique({ where: { id: proposalId }, select: { id: true, partner: { select: { userId: true, user: { select: { name: true } } } }, serviceRequest: { select: { service: { select: { name: true } } } } } })
    if (!p) return null
    return sendWaToUser(p.partner.userId, WA.C13({ proposalId: p.id, partnerName: p.partner.user.name, service: p.serviceRequest.service.name }))
  })
}

// ─── Bookings ───────────────────────────────────────────────────────────────

/**
 * Status changes: confirmed → reserva_confirmada_cliente; in progress → B13; completed → B14 (client) and
 * C22 (partner); cancelled by the client → C16 (partner) and reserva_cancelada (client, not from the chat);
 * cancelled by the partner → B9 if it was pending, B19 if it was confirmed (the request was reopened).
 */
export function waBookingStatus(p: { bookingId: string; from: string; to: string; actorRole: 'CLIENT' | 'PARTNER' | 'ADMIN'; origin?: OriginLike; reopened?: boolean }) {
  return safe(`booking:${p.to}`, async () => {
    const b = await loadBooking(p.bookingId)
    if (!b) return null
    const clientId = b.row.userId
    const partnerUserId = b.row.partner?.userId ?? null
    const actorIsPartnerFromChat = p.actorRole === 'PARTNER' && fromChat(p.origin)
    if (p.to === 'CONFIRMED') return sendWaToUser(clientId, WA.reservaConfirmada(b.data))
    if (p.to === 'IN_PROGRESS') return sendWaToUser(clientId, WA.B13(b.data))
    if (p.to === 'COMPLETED') {
      await sendWaToUser(clientId, WA.B14(b.data))
      if (partnerUserId && !actorIsPartnerFromChat) await sendWaToUser(partnerUserId, WA.C22(b.data))
      return true
    }
    if (p.to === 'CANCELLED') {
      if (p.actorRole === 'CLIENT') {
        if (partnerUserId) await sendWaToUser(partnerUserId, WA.C16(b.data))
        if (!fromChat(p.origin)) await sendWaToUser(clientId, WA.reservaCancelada(b.data))
        return true
      }
      if (p.actorRole === 'PARTNER') {
        if (!p.reopened) return sendWaToUser(clientId, WA.reservaCancelada(b.data))
        return sendWaToUser(clientId, p.from === 'CONFIRMED' ? WA.B19(b.data) : WA.B9(b.data))
      }
    }
    return null
  })
}

/** B10 to the client when the partner or the team moved it; C15 to the partner when the client or the team did. */
export function waBookingRescheduled(p: { bookingId: string; actorRole: 'CLIENT' | 'PARTNER' | 'ADMIN' }) {
  return safe('B10/C15', async () => {
    const b = await loadBooking(p.bookingId)
    if (!b) return null
    if (p.actorRole !== 'CLIENT') await sendWaToUser(b.row.userId, WA.B10({ ...b.data, pending: b.row.status === 'PENDING' }))
    if (p.actorRole !== 'PARTNER' && b.row.partner?.userId) await sendWaToUser(b.row.partner.userId, WA.C15(b.data))
    return true
  })
}

/** B11 + C17 (tomorrow) or B12 + C18 (soon). Returns what went to the client and to the partner. */
export async function waBookingReminder(bookingId: string, kind: 'day' | 'soon'): Promise<{ client: WaOutcome | null; partner: WaOutcome | null }> {
  const out = { client: null as WaOutcome | null, partner: null as WaOutcome | null }
  await safe(`reminder:${kind}`, async () => {
    const b = await loadBooking(bookingId)
    if (!b) return null
    out.client = await sendWaToUser(b.row.userId, kind === 'day' ? WA.B11(b.data) : WA.B12(b.data))
    if (b.row.partner?.userId) out.partner = await sendWaToUser(b.row.partner.userId, kind === 'day' ? WA.C17(b.data) : WA.C18(b.data))
    return true
  })
  return out
}

// ─── Payments and reviews ───────────────────────────────────────────────────

/** C20: the client reported the payment. */
export function waPaymentReported(bookingId: string, method: string, at = new Date()) {
  return safe('C20', async () => {
    const b = await loadBooking(bookingId)
    if (!b?.row.partner?.userId) return null
    return sendWaToUser(b.row.partner.userId, WA.C20({ ...b.data, method, at }))
  })
}

/** B16: the partner confirmed the payment. */
export function waPaymentConfirmed(bookingId: string) {
  return safe('B16', async () => {
    const b = await loadBooking(bookingId)
    if (!b) return null
    const payment = await prisma.payment.findUnique({ where: { bookingId }, select: { totalAmount: true } })
    return sendWaToUser(b.row.userId, WA.B16({ ...b.data, price: payment?.totalAmount ?? b.data.price }))
  })
}

/** D5 to the admins: client and partner disagree on the payment. */
export function waPaymentDispute(bookingId: string, at = new Date()) {
  return safe('D5', async () => {
    const b = await loadBooking(bookingId)
    if (!b) return null
    return sendWaToAdmins((a) => WA.D5({ adminName: a.name, bookingId, service: b.data.service, clientName: b.data.clientName ?? '', partnerName: b.data.partnerName ?? '', at }))
  })
}

/** B17 to the client and D5 to the admins: the partner says the money did not arrive. */
export function waPaymentRejected(bookingId: string, reason: string, at = new Date()) {
  return safe('B17', async () => {
    const b = await loadBooking(bookingId)
    if (!b) return null
    await sendWaToUser(b.row.userId, WA.B17({ ...b.data, reason, at }))
    await waPaymentDispute(bookingId, at)
    return true
  })
}

/** C21: reminder to confirm a reported payment (n-th reminder). */
export function waPaymentReminder(bookingId: string, reminder: number) {
  return safe('C21', async () => {
    const b = await loadBooking(bookingId)
    if (!b?.row.partner?.userId) return null
    const payment = await prisma.payment.findUnique({ where: { bookingId }, select: { totalAmount: true } })
    return sendWaToUser(b.row.partner.userId, WA.C21({ ...b.data, price: payment?.totalAmount ?? b.data.price, reminder }))
  })
}

/** B18: the client has not rated 24 h after the service. */
export function waRatingReminder(bookingId: string) {
  return safe('B18', async () => {
    const b = await loadBooking(bookingId)
    if (!b) return null
    return sendWaToUser(b.row.userId, WA.B18(b.data))
  })
}

/** C23: a client rated the partner. */
export function waReviewReceived(bookingId: string, rating: number) {
  return safe('C23', async () => {
    const b = await loadBooking(bookingId)
    if (!b?.row.partner?.userId) return null
    return sendWaToUser(b.row.partner.userId, WA.C23({ bookingId, partnerName: b.data.partnerName ?? '', clientName: b.data.clientName ?? '', rating, service: b.data.service }))
  })
}

// ─── Guarantee ──────────────────────────────────────────────────────────────

/** B20 to the client (not from the chat), C24 to the partner, D3 to the admins. */
export function waGuaranteeOpened(claimId: string, origin?: OriginLike) {
  return safe('B20/C24/D3', async () => {
    const c = await prisma.guaranteeClaim.findUnique({ where: { id: claimId }, select: { id: true, type: true, clientId: true, bookingId: true } })
    if (!c) return null
    const b = await loadBooking(c.bookingId)
    if (!b) return null
    if (!fromChat(origin)) await sendWaToUser(c.clientId, WA.B20({ claimId: c.id, clientName: b.data.clientName ?? '', service: b.data.service }))
    if (b.row.partner?.userId) await sendWaToUser(b.row.partner.userId, WA.C24({ claimId: c.id, partnerName: b.data.partnerName ?? '', service: b.data.service, type: c.type }))
    await sendWaToAdmins((a) => WA.D3({ adminName: a.name, claimId: c.id, type: c.type, service: b.data.service }))
    return true
  })
}

/** B21 to the client; to the partner C25 (redo), C26 (strike) or C27 (paused). */
export function waGuaranteeResolved(p: { claimId: string; remedy: string; strike: boolean; consequence: string; strikes?: number }) {
  return safe('B21', async () => {
    const c = await prisma.guaranteeClaim.findUnique({ where: { id: p.claimId }, select: { id: true, type: true, clientId: true, bookingId: true } })
    if (!c) return null
    const b = await loadBooking(c.bookingId)
    if (!b) return null
    await sendWaToUser(c.clientId, WA.B21({ claimId: c.id, clientName: b.data.clientName ?? '', remedy: p.remedy }))
    const partnerUserId = b.row.partner?.userId
    if (!partnerUserId) return true
    const partnerName = b.data.partnerName ?? ''
    if (p.remedy === 'redo') await sendWaToUser(partnerUserId, WA.C25({ claimId: c.id, partnerName, service: b.data.service }))
    if (p.strike) {
      if (p.consequence === 'none') await sendWaToUser(partnerUserId, WA.C26({ claimId: c.id, partnerName, service: b.data.service, type: c.type }))
      else await sendWaToUser(partnerUserId, WA.C27({ claimId: c.id, partnerName, strikes: p.strikes ?? 2 }))
    }
    return true
  })
}

// ─── Accounts and documents ─────────────────────────────────────────────────

/** B1 / C1: the account was created. `suffix` is the access link path (auth/magic?token=…) or a panel path. */
export function waAccountCreated(p: { userId: string; role: 'CLIENT' | 'PARTNER'; name: string; suffix: string }) {
  return safe(p.role === 'PARTNER' ? 'C1' : 'B1', () => sendWaToUser(p.userId, p.role === 'PARTNER' ? WA.C1(p) : WA.B1(p)))
}

/** C4: the partner uploaded a document (not from the chat, where the agent already told them). */
export function waDocumentUploaded(documentId: string, origin?: OriginLike) {
  if (fromChat(origin)) return Promise.resolve(null)
  return safe('C4', async () => {
    const d = await prisma.verificationDocument.findUnique({ where: { id: documentId }, select: { id: true, type: true, partner: { select: { userId: true, user: { select: { name: true } } } } } })
    if (!d) return null
    return sendWaToUser(d.partner.userId, WA.C4({ documentId: d.id, name: d.partner.user.name, type: d.type }))
  })
}

const IDENTITY_TYPES = new Set(['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'])

/** C5 (approved, not identity), C7 (identity approved: profile active) or C6 (rejected). */
export function waDocumentReviewed(documentId: string, status: string, reason?: string | null) {
  return safe('C5/C6/C7', async () => {
    const d = await prisma.verificationDocument.findUnique({
      where: { id: documentId },
      select: { id: true, type: true, partnerId: true, partner: { select: { userId: true, user: { select: { name: true } }, services: { where: { active: true }, select: { service: { select: { name: true } } }, take: 3 } } } },
    })
    if (!d) return null
    const name = d.partner.user.name
    if (status === 'REJECTED') return sendWaToUser(d.partner.userId, WA.C6({ documentId: d.id, name, type: d.type, reason: reason ?? '' }))
    if (status !== 'APPROVED') return null
    if (IDENTITY_TYPES.has(d.type)) return sendWaToUser(d.partner.userId, WA.C7({ partnerId: d.partnerId, name, services: d.partner.services.map((s) => s.service.name) }))
    return sendWaToUser(d.partner.userId, WA.C5({ documentId: d.id, name, type: d.type }))
  })
}

/** A1: the link code goes to the account's phone as the AUTHENTICATION template. */
export function waLinkCode(p: { userId: string; phone: string; code: string; codeId: string }) {
  return safe('A1', async () => {
    const phone = toE164(p.phone)
    if (!phone) return null
    return sendWaToUser(p.userId, WA.A1({ code: p.code, codeId: p.codeId }))
  })
}

/** A1 for the phone login: the number has no account yet (or we do not know which), so it goes to the phone. */
export function waLoginCode(p: { phone: string; code: string; codeId: string }) {
  return safe('A1', async () => {
    const phone = toE164(p.phone)
    if (!phone) return null
    return deliverWa({ userId: null, phone }, WA.A1Login({ code: p.code, codeId: p.codeId }))
  })
}

/** B2 / C2: an access link the person asked for, to the account's own WhatsApp. `suffix` = auth/magic?token=… */
export function waAccessLink(p: { userId: string; role: 'CLIENT' | 'PARTNER'; name: string; suffix: string; tokenId: string }) {
  return safe(p.role === 'PARTNER' ? 'C2' : 'B2', () => sendWaToUser(p.userId, p.role === 'PARTNER' ? WA.C2(p) : WA.B2(p)))
}

// ─── Team alerts ────────────────────────────────────────────────────────────

/** D1: the AI handed a conversation to a person (admins of that workspace). */
export function waHandoff(p: { conversationId: string; workspaceId: string; channel: string; reason: string }) {
  const at = new Date()
  return safe('D1', () => sendWaToAdmins((a) => WA.D1({ adminName: a.name, conversationId: p.conversationId, channel: p.channel, reason: p.reason, at }), { workspaceId: p.workspaceId }))
}

/** D2: a copilot action waits for approval. */
export function waActionAwaiting(p: { actionId: string; conversationId: string; workspaceId: string; summary: string }) {
  return safe('D2', () => sendWaToAdmins((a) => WA.D2({ adminName: a.name, actionId: p.actionId, conversationId: p.conversationId, summary: p.summary.slice(0, 180) }), { workspaceId: p.workspaceId }))
}

/** D9: a critical incident was opened. */
export function waCriticalIncident(p: { incidentId: string; title: string }) {
  return safe('D9', () => sendWaToAdmins((a) => WA.D9({ adminName: a.name, incidentId: p.incidentId, title: p.title.slice(0, 180) })))
}
