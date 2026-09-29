import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-utils'
import { opsErrorResponse } from '@/lib/ops/actor'
import { adminBookingStatus, adminReactivate, adminReschedule, openSupportCase, postSupportMessage, renotifyPartners, type AdminActor } from '@/lib/admin/interventions'

export const dynamic = 'force-dynamic'

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('chat_message'), proposalId: z.string().min(1), text: z.string().min(2).max(1000), to: z.enum(['client', 'partner', 'both']) }),
  z.object({ action: z.literal('renotify') }),
  z.object({ action: z.literal('reactivate') }),
  z.object({ action: z.literal('booking_status'), bookingId: z.string().min(1), status: z.enum(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']), reason: z.string().max(500).optional(), reopen: z.boolean().optional() }),
  z.object({ action: z.literal('reschedule'), bookingId: z.string().min(1), date: z.string(), time: z.string() }),
  z.object({ action: z.literal('open_case'), subject: z.string().min(3).max(200), description: z.string().max(4000).default(''), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional() }),
])

/** The team steps in on a request (see lib/admin/interventions.ts). */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await context.params
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  const actor: AdminActor = { userId: admin.id, role: 'ADMIN', email: admin.email }
  const b = parsed.data
  try {
    switch (b.action) {
      case 'chat_message': return NextResponse.json(await postSupportMessage(actor, { requestId: id, proposalId: b.proposalId, text: b.text, to: b.to }))
      case 'renotify': return NextResponse.json(await renotifyPartners(actor, id))
      case 'reactivate': return NextResponse.json(await adminReactivate(actor, id))
      case 'booking_status': return NextResponse.json(await adminBookingStatus(actor, { requestId: id, bookingId: b.bookingId, status: b.status, reason: b.reason, reopen: b.reopen }))
      case 'reschedule': return NextResponse.json(await adminReschedule(actor, { requestId: id, bookingId: b.bookingId, date: b.date, time: b.time }))
      case 'open_case': return NextResponse.json(await openSupportCase(actor, { requestId: id, subject: b.subject, description: b.description, priority: b.priority }))
    }
  } catch (err) {
    return opsErrorResponse(err)
  }
}
