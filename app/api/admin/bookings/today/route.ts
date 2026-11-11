import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { bookingWhen } from '@/lib/bookings/when'
import { enteredAtOf, marksFor } from '@/lib/bookings/followups'
import { todayStatus } from '@/lib/bookings/followups-core'

export const dynamic = 'force-dynamic'

const DAY = 24 * 3600_000
const first = (n: string | null | undefined) => n?.trim().split(/\s+/)[0] || '—'

/**
 * Services of today (Bogotá) with their live state from the booking follow-up marks: confirmed or
 * re-confirmed, partner on the way (ETA), started, finished, paid, and the red flags (late, not
 * re-confirmed, on hold, no-show claim…). Names are first names only; no contact data.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const now = new Date()
  // Bookings are stored as the Bogotá day at 00:00 UTC
  const day = new Date(now.getTime() - 5 * 3600_000).toISOString().slice(0, 10)
  const start = new Date(`${day}T00:00:00.000Z`)
  const rows = await prisma.booking.findMany({
    where: { scheduledDate: { gte: start, lt: new Date(start.getTime() + DAY) } },
    select: {
      id: true, status: true, scheduledDate: true, scheduledTime: true, totalPrice: true, city: true,
      service: { select: { name: true } },
      user: { select: { name: true } },
      partner: { select: { user: { select: { name: true } } } },
      payment: { select: { status: true, confirmationStatus: true } },
      proposal: { select: { serviceRequestId: true } },
    },
    orderBy: [{ scheduledTime: 'asc' }],
    take: 300,
  })
  const ids = rows.map((b) => b.id)
  const [marks, started] = await Promise.all([marksFor(ids), enteredAtOf(ids, 'IN_PROGRESS')])
  const items = rows.map((b) => {
    const when = bookingWhen(b).getTime()
    const paid = b.payment?.status === 'APPROVED' || b.payment?.confirmationStatus === 'CONFIRMED'
    const s = todayStatus({ status: b.status, when, now: now.getTime(), marks: marks.get(b.id) ?? new Map(), paid })
    return {
      id: b.id,
      ref: b.id.slice(-6).toUpperCase(),
      requestId: b.proposal?.serviceRequestId ?? null,
      when: new Date(when).toISOString(),
      service: b.service?.name ?? 'Servicio',
      client: first(b.user?.name),
      partner: first(b.partner?.user?.name),
      price: b.totalPrice,
      city: b.city,
      status: b.status,
      stage: s.stage,
      flags: s.flags,
      eta: s.eta ? new Date(s.eta).toISOString() : null,
      startedAt: started.get(b.id)?.toISOString() ?? null,
    }
  }).sort((a, b) => b.flags.length - a.flags.length || a.when.localeCompare(b.when))
  return NextResponse.json({ day, items })
}
