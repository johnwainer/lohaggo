/**
 * WhatsApp templates sent by time rather than by an action, run from the existing crons:
 * - request-lifecycle (every 15 min): C14, D6, C19, D7, D4, and the daily D10 (7:00) and D8 (9:00).
 * - notification-reminders (every 30 min): B15.
 * - automations (hourly): C3, C8, C9, B23, C30, C29, B24.
 * Every send is deduplicated in lib/messaging/wa-send.ts, so a window spanning several runs sends once.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { bookingWhen } from '@/lib/bookings/when'
import { WA } from '@/lib/messaging/wa-specs'
import { deliverWa, sendWaToAdmins, sendWaToUser, type WaOutcome } from '@/lib/messaging/wa-send'
import { bogotaClock, cityLabel } from '@/lib/messaging/wa-format'

const logger = createLogger('wa-scheduled')
const H = 3600_000
const DAY = 24 * H
const IDENTITY = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'] as const

type Tally = Record<string, number>
function count(t: Tally, key: string, r: WaOutcome | null | undefined | { admins: number; sent: number }) {
  if (!r) return
  const n = 'sent' in r ? r.sent : r.ok ? 1 : 0
  if (n) t[key] = (t[key] ?? 0) + n
}

async function step(t: Tally, name: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (err) {
    t[`${name}_error`] = 1
    logger.warn(`WhatsApp scheduled step ${name} failed`, { err: err instanceof Error ? err.message : err })
  }
}

const bookingSelect = {
  id: true, userId: true, status: true, scheduledDate: true, scheduledTime: true, totalPrice: true, address: true, city: true, updatedAt: true,
  service: { select: { name: true } },
  user: { select: { name: true } },
  partner: { select: { id: true, userId: true, user: { select: { name: true } } } },
} as const
type BookingRow = { id: string; scheduledDate: Date; scheduledTime: string; totalPrice: number; address: string; city: string; service: { name: string } | null; user: { name: string } | null; partner: { user: { name: string } | null } | null }
const dataOf = (b: BookingRow) => ({ id: b.id, when: bookingWhen(b), service: b.service?.name ?? 'servicio', price: b.totalPrice, clientName: b.user?.name ?? null, partnerName: b.partner?.user?.name ?? null, address: b.address, city: b.city })

/** Every 15 min (request-lifecycle). */
export async function runWaLifecycle(now = new Date()): Promise<Tally> {
  const t: Tally = {}

  await step(t, 'C14_D6', async () => {
    const pending = await prisma.booking.findMany({
      where: { status: 'PENDING', partnerId: { not: null }, updatedAt: { lte: new Date(now.getTime() - 2 * H), gte: new Date(now.getTime() - 3 * DAY) } },
      select: bookingSelect, take: 100, orderBy: { updatedAt: 'asc' },
    })
    for (const b of pending) {
      if (bookingWhen(b).getTime() < now.getTime()) continue
      if (b.partner?.userId) count(t, 'C14', await sendWaToUser(b.partner.userId, WA.C14(dataOf(b)), now))
      if (b.updatedAt.getTime() <= now.getTime() - 6 * H) count(t, 'D6', await sendWaToAdmins((a) => WA.D6({ ...dataOf(b), adminName: a.name }), {}, now))
    }
  })

  await step(t, 'C19', async () => {
    const running = await prisma.booking.findMany({
      where: { status: 'IN_PROGRESS', updatedAt: { lte: new Date(now.getTime() - 3 * H), gte: new Date(now.getTime() - 2 * DAY) } },
      select: bookingSelect, take: 100,
    })
    for (const b of running) if (b.partner?.userId) count(t, 'C19', await sendWaToUser(b.partner.userId, WA.C19(dataOf(b)), now))
  })

  await step(t, 'D7', async () => {
    const quiet = await prisma.serviceRequest.findMany({
      where: { status: 'ACTIVE', expiresAt: { gt: now }, proposals: { none: {} }, createdAt: { lte: new Date(now.getTime() - 4 * H), gte: new Date(now.getTime() - DAY) } },
      select: { id: true, address: true, city: true, createdAt: true, service: { select: { name: true } } }, take: 50,
    })
    for (const r of quiet) {
      const hours = Math.floor((now.getTime() - r.createdAt.getTime()) / H)
      count(t, 'D7', await sendWaToAdmins((a) => WA.D7({ adminName: a.name, requestId: r.id, service: r.service.name, address: r.address, city: r.city, hours }), {}, now))
    }
  })

  await step(t, 'D4', async () => {
    const claims = await prisma.guaranteeClaim.findMany({
      where: { status: { in: ['OPEN', 'REDO_SCHEDULED', 'REFUND_REVIEW'] }, slaDueAt: { lte: new Date(now.getTime() + 12 * H), gte: new Date(now.getTime() - 2 * DAY) } },
      select: { id: true, slaDueAt: true }, take: 50,
    })
    for (const c of claims) count(t, 'D4', await sendWaToAdmins((a) => WA.D4({ adminName: a.name, claimId: c.id, dueAt: c.slaDueAt, now }), {}, now))
  })

  const clock = bogotaClock(now)
  if (clock.hour >= 7 && clock.hour < 12) {
    await step(t, 'D10', async () => {
      const today = new Date(`${clock.dateKey}T00:00:00-05:00`)
      const since = new Date(today.getTime() - DAY)
      const [requests, bookings, sales, findings] = await Promise.all([
        prisma.serviceRequest.count({ where: { createdAt: { gte: since, lt: today } } }),
        prisma.booking.count({ where: { createdAt: { gte: since, lt: today } } }),
        prisma.payment.aggregate({ where: { status: 'APPROVED', paidAt: { gte: since, lt: today } }, _sum: { totalAmount: true } }),
        prisma.haggoFinding.count({ where: { status: { in: ['new', 'seen'] } } }).catch(() => 0),
      ])
      count(t, 'D10', await sendWaToAdmins((a) => WA.D10({ adminName: a.name, requests, bookings, sales: sales._sum.totalAmount ?? 0, findings, dateKey: clock.dateKey }), {}, now))
    })
  }
  if (clock.hour >= 9 && clock.hour < 14) {
    await step(t, 'D8', async () => {
      const [pending, oldest] = await Promise.all([
        prisma.verificationDocument.count({ where: { status: 'PENDING' } }),
        prisma.verificationDocument.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      ])
      if (!pending || !oldest) return
      count(t, 'D8', await sendWaToAdmins((a) => WA.D8({ adminName: a.name, pending, oldestMs: now.getTime() - oldest.createdAt.getTime(), dateKey: clock.dateKey }), {}, now))
    })
  }
  return t
}

/** Every 30 min (notification-reminders): B15, payment still not reported 24 h after completion. */
export async function runWaPaymentPending(now = new Date()): Promise<Tally> {
  const t: Tally = {}
  await step(t, 'B15', async () => {
    const done = await prisma.booking.findMany({
      where: {
        status: 'COMPLETED', updatedAt: { lte: new Date(now.getTime() - DAY), gte: new Date(now.getTime() - 30 * H) },
        OR: [{ payment: null }, { payment: { confirmationStatus: { in: ['NONE', 'REJECTED_BY_PARTNER'] }, status: { not: 'APPROVED' } } }],
      },
      select: bookingSelect, take: 100,
    })
    for (const b of done) count(t, 'B15', await sendWaToUser(b.userId, WA.B15(dataOf(b)), now))
  })
  return t
}

/** Hourly (automations): partner onboarding (C3, C8, C9), win-back (B23, C30), demand (C29), unfinished chat requests (B24). */
export async function runWaDaily(now = new Date()): Promise<Tally> {
  const t: Tally = {}

  await step(t, 'C3', async () => {
    for (const day of [1, 3, 7] as const) {
      const partners = await prisma.partnerProfile.findMany({
        where: {
          verified: false, createdAt: { lte: new Date(now.getTime() - day * DAY), gt: new Date(now.getTime() - (day + 1) * DAY) },
          documents: { none: { type: { in: [...IDENTITY] }, status: { in: ['PENDING', 'APPROVED'] } } },
        },
        select: { userId: true, user: { select: { name: true } } }, take: 100,
      })
      for (const p of partners) count(t, 'C3', await sendWaToUser(p.userId, WA.C3({ userId: p.userId, name: p.user.name, day }), now))
    }
  })

  await step(t, 'C8', async () => {
    const approved = await prisma.verificationDocument.findMany({
      where: { type: { in: [...IDENTITY] }, status: 'APPROVED', reviewedAt: { lte: new Date(now.getTime() - 3 * DAY), gt: new Date(now.getTime() - 5 * DAY) }, partner: { verified: true, isActive: true, services: { none: { active: true } } } },
      select: { partner: { select: { id: true, userId: true, user: { select: { name: true } } } } }, take: 100,
    })
    const seen = new Set<string>()
    for (const d of approved) {
      if (seen.has(d.partner.id)) continue
      seen.add(d.partner.id)
      count(t, 'C8', await sendWaToUser(d.partner.userId, WA.C8({ partnerId: d.partner.id, name: d.partner.user.name }), now))
    }
  })

  await step(t, 'C9', async () => {
    const done = await prisma.booking.findMany({
      where: { status: 'COMPLETED', updatedAt: { gte: new Date(now.getTime() - 3 * DAY) }, partner: { bankAccounts: { none: {} } } },
      select: { id: true, partner: { select: { id: true, userId: true, user: { select: { name: true } } } } }, orderBy: { updatedAt: 'asc' }, take: 100,
    })
    const seen = new Set<string>()
    for (const b of done) {
      if (!b.partner || seen.has(b.partner.id)) continue
      seen.add(b.partner.id)
      count(t, 'C9', await sendWaToUser(b.partner.userId, WA.C9({ partnerId: b.partner.id, name: b.partner.user.name, bookingId: b.id }), now))
    }
  })

  await step(t, 'B23', async () => {
    const last = await prisma.booking.findMany({
      where: { status: 'COMPLETED', updatedAt: { lte: new Date(now.getTime() - 30 * DAY), gt: new Date(now.getTime() - 31 * DAY) }, user: { excludedFromMarketing: false } },
      select: { id: true, userId: true, updatedAt: true, service: { select: { name: true } }, user: { select: { name: true } }, partner: { select: { user: { select: { name: true } } } } }, take: 100,
    })
    for (const b of last) {
      const since = { gt: b.updatedAt }
      const again = await prisma.serviceRequest.count({ where: { userId: b.userId, createdAt: since } }) + await prisma.booking.count({ where: { userId: b.userId, createdAt: since } })
      if (again) continue
      count(t, 'B23', await sendWaToUser(b.userId, WA.B23({ userId: b.userId, clientName: b.user.name, service: b.service.name, partnerName: b.partner?.user?.name ?? 'tu socio', bookingId: b.id }), now))
    }
  })

  await step(t, 'C30', async () => {
    const idle = await prisma.partnerProfile.findMany({
      where: { verified: true, isActive: true, createdAt: { lte: new Date(now.getTime() - 30 * DAY) }, user: { excludedFromMarketing: false }, proposals: { none: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } } } },
      select: { id: true, userId: true, city: true, user: { select: { name: true } }, services: { where: { active: true }, select: { serviceId: true, service: { select: { name: true } } } } }, take: 50,
    })
    for (const p of idle) {
      if (!p.services.length) continue
      const open = await prisma.serviceRequest.findFirst({ where: { status: 'ACTIVE', expiresAt: { gt: now }, city: p.city, serviceId: { in: p.services.map((s) => s.serviceId) } }, select: { service: { select: { name: true } } } })
      if (!open) continue
      count(t, 'C30', await sendWaToUser(p.userId, WA.C30({ partnerId: p.id, partnerName: p.user.name, service: open.service.name }), now))
    }
  })

  await step(t, 'C29', async () => {
    const unmet = await prisma.serviceRequest.groupBy({ by: ['serviceId', 'city'], where: { status: 'EXPIRED', updatedAt: { gte: new Date(now.getTime() - 7 * DAY) }, proposals: { none: {} } }, _count: { _all: true } })
    let sent = 0
    for (const g of unmet) {
      if (sent >= 100) break
      const service = await prisma.service.findUnique({ where: { id: g.serviceId }, select: { name: true } })
      if (!service) continue
      const partners = await prisma.partnerProfile.findMany({
        where: { verified: true, isActive: true, city: g.city, user: { excludedFromMarketing: false }, services: { none: { serviceId: g.serviceId, active: true } } },
        select: { id: true, userId: true, user: { select: { name: true } } }, take: 30,
      })
      for (const p of partners) {
        const r = await sendWaToUser(p.userId, WA.C29({ partnerId: p.id, partnerName: p.user.name, service: service.name, city: cityLabel(g.city), now }), now)
        count(t, 'C29', r)
        if (r?.ok) sent++
      }
    }
  })

  await step(t, 'B24', async () => {
    const drafts = await prisma.aiAgentAction.findMany({
      where: { tool: 'crear_solicitud', status: { in: ['proposed', 'expired'] }, createdAt: { lte: new Date(now.getTime() - DAY), gte: new Date(now.getTime() - 2 * DAY) }, conversation: { channel: 'WHATSAPP' } },
      select: { conversationId: true, input: true, createdAt: true, conversation: { select: { id: true, contactPhone: true, contactName: true, userId: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    })
    const seen = new Set<string>()
    for (const d of drafts) {
      if (seen.has(d.conversationId)) continue
      seen.add(d.conversationId)
      const finished = await prisma.aiAgentAction.count({ where: { conversationId: d.conversationId, tool: 'crear_solicitud', status: 'executed', createdAt: { gte: d.createdAt } } })
      if (finished) continue
      const service = String((d.input as Record<string, unknown> | null)?.servicio ?? '').trim()
      if (!service) continue
      const spec = WA.B24({ conversationId: d.conversationId, name: d.conversation.contactName, service })
      const r = d.conversation.userId
        ? await sendWaToUser(d.conversation.userId, spec, now)
        : await deliverWa({ userId: null, phone: d.conversation.contactPhone, name: d.conversation.contactName }, spec, now)
      count(t, 'B24', r)
    }
  })

  return t
}
