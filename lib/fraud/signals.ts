import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { FRAUD_TYPE, contactBlockSeverity, dayKey, findDuplicateGroups, isOffPlatformPair, phoneKey, signalKey, type AccountLite, type PairActivity, type Severity } from '@/lib/fraud/core'

const logger = createLogger('fraud-signals')
const DAY = 86_400_000

/** The idempotency key travels inside `details` (JSON) so the existing FraudSignal table is used as is. */
const keyFilter = (key: string) => ({ details: { contains: `"key":"${key}"` } })

async function openOrRecent(type: string, key: string, since: Date) {
  return prisma.fraudSignal.findFirst({
    where: { type, ...keyFilter(key), OR: [{ status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, { createdAt: { gte: since } }] },
    select: { id: true },
  })
}

/**
 * A chat message was blocked by the contact guard. One signal per chat/sender/day: more attempts the same day
 * raise its counter and score; 3+ in a week make it HIGH. Never throws (the chat must go on).
 */
export async function recordContactBlock(p: { userId: string; partnerProfileId: string; chatId: string; side: 'CLIENT' | 'PARTNER'; reason: string; fragment: string; bookingId?: string | null }, now = new Date()) {
  try {
    const key = signalKey(FRAUD_TYPE.contactBlocked, [p.chatId, p.userId], dayKey(now))
    const weekAgo = new Date(now.getTime() - 7 * DAY)
    const attemptsBefore = await prisma.adminAuditLog.count({ where: { action: 'CHAT_CONTACT_BLOCKED', entityType: 'Chat', actorId: p.userId, createdAt: { gte: weekAgo } } })
    const { severity, score } = contactBlockSeverity(Math.max(1, attemptsBefore))
    const existing = await prisma.fraudSignal.findFirst({ where: { type: FRAUD_TYPE.contactBlocked, ...keyFilter(key) }, select: { id: true, details: true } })
    if (existing) {
      let count = 1
      try { count = (JSON.parse(existing.details ?? '{}').count ?? 1) + 1 } catch { /* old row */ }
      await prisma.fraudSignal.update({ where: { id: existing.id }, data: { score, severity, reason: `${count} intentos de compartir ${p.reason} hoy`, details: JSON.stringify({ key, count, side: p.side, chatId: p.chatId, last: p.fragment.slice(0, 40) }) } })
      return
    }
    await prisma.fraudSignal.create({
      data: {
        type: FRAUD_TYPE.contactBlocked, userId: p.userId, partnerId: p.partnerProfileId, bookingId: p.bookingId ?? null,
        severity, score, reason: `Intentó compartir ${p.reason} en el chat`,
        details: JSON.stringify({ key, count: 1, side: p.side, chatId: p.chatId, last: p.fragment.slice(0, 40) }),
      },
    })
  } catch (err) {
    logger.warn('recordContactBlock failed', { err: err instanceof Error ? err.message : err })
  }
}

/** Pairs with one completed booking and a chat that goes on (see isOffPlatformPair). */
export async function loadPairActivity(now = new Date(), lookbackDays = 120): Promise<PairActivity[]> {
  const since = new Date(now.getTime() - lookbackDays * DAY)
  const completed = await prisma.booking.groupBy({
    by: ['userId', 'partnerId'],
    where: { status: 'COMPLETED', partnerId: { not: null }, updatedAt: { gte: since } },
    _count: { _all: true },
    _min: { updatedAt: true },
    having: { userId: { _count: { equals: 1 } } },
  })
  const out: PairActivity[] = []
  for (const c of completed.slice(0, 2000)) {
    if (!c.partnerId) continue
    const [active, lastMessage, after] = await Promise.all([
      prisma.booking.count({ where: { userId: c.userId, partnerId: c.partnerId, status: { not: 'CANCELLED' } } }),
      prisma.chatMessage.findFirst({ where: { chat: { clientId: c.userId, partnerId: c.partnerId }, senderId: { not: 'SYSTEM' } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.chatMessage.count({ where: { chat: { clientId: c.userId, partnerId: c.partnerId }, senderId: { not: 'SYSTEM' }, createdAt: { gt: c._min.updatedAt ?? since } } }),
    ])
    out.push({ clientId: c.userId, partnerId: c.partnerId, activeBookings: active, completedBookings: c._count._all, firstCompletedAt: c._min.updatedAt ?? null, messagesAfter: after, lastMessageAt: lastMessage?.createdAt ?? null })
  }
  return out
}

async function accountsForDuplicates(): Promise<AccountLite[]> {
  const rows = await prisma.user.findMany({
    where: { role: { in: ['CLIENT', 'PARTNER'] } },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true, acquisition: true },
    orderBy: { createdAt: 'desc' },
    take: 30000,
  })
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, role: r.role, isActive: r.isActive, createdAt: r.createdAt, acquisitionSource: (r.acquisition as { source?: string } | null)?.source ?? null }))
}

/** Read-only list for the manual merge review (superadmin). */
export async function listDuplicateAccounts() {
  const accounts = await accountsForDuplicates()
  return findDuplicateGroups(accounts).map((g) => ({
    reason: g.reason,
    key: g.reason === 'phone' ? `…${g.key.slice(-4)}` : g.key,
    accounts: g.accounts.map((a) => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, role: a.role, isActive: a.isActive, createdAt: a.createdAt, viaChat: a.acquisitionSource === 'inbox' })),
  }))
}

/** Nightly: off-platform pairs and shared phones. Idempotent per pair/phone and day (and while a signal stays open). */
export async function runFraudScan(now = new Date()) {
  const day = dayKey(now)
  const since = new Date(now.getTime() - DAY)
  let pairs = 0
  let phones = 0

  for (const p of await loadPairActivity(now)) {
    if (!isOffPlatformPair(p, now)) continue
    const key = signalKey(FRAUD_TYPE.offPlatformPair, [p.clientId, p.partnerId])
    if (await openOrRecent(FRAUD_TYPE.offPlatformPair, key, new Date(now.getTime() - 30 * DAY))) continue
    await prisma.fraudSignal.create({
      data: {
        type: FRAUD_TYPE.offPlatformPair, userId: p.clientId, partnerId: p.partnerId, severity: 'MEDIUM' as Severity, score: 40 + Math.min(40, p.messagesAfter),
        reason: `Un solo servicio completado y ${p.messagesAfter} mensajes después sin una segunda reserva`,
        details: JSON.stringify({ key, day, messagesAfter: p.messagesAfter, firstCompletedAt: p.firstCompletedAt, lastMessageAt: p.lastMessageAt }),
      },
    })
    pairs++
  }

  const accounts = await accountsForDuplicates()
  for (const g of findDuplicateGroups(accounts)) {
    if (g.reason !== 'phone') continue
    const key = signalKey(FRAUD_TYPE.sharedPhone, [phoneKey(g.accounts[0].phone) ?? g.key])
    if (await openOrRecent(FRAUD_TYPE.sharedPhone, key, since)) continue
    await prisma.fraudSignal.create({
      data: {
        type: FRAUD_TYPE.sharedPhone, userId: g.accounts[g.accounts.length - 1].id, severity: 'LOW' as Severity, score: 15 + g.accounts.length * 5,
        reason: `${g.accounts.length} cuentas activas con el mismo celular (…${g.key.slice(-4)})`,
        details: JSON.stringify({ key, day, accountIds: g.accounts.map((a) => a.id) }),
      },
    })
    phones++
  }
  return { pairs, phones }
}
