import { NextResponse } from "next/server"
import { createLogger } from '@/lib/logger'
import { currentActor } from '@/lib/ops/actor'
import { bookingsFor } from '@/lib/bookings/ops'
import { followupOptions } from '@/lib/bookings/followups'
import { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'


const logger = createLogger('bookings')

export async function GET(request: Request) {
  try {
    const actor = await currentActor()
    if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const searchParams = new URL(request.url).searchParams
    const status = searchParams.get("status")
    const statuses = status && (Object.values(BookingStatus) as string[]).includes(status) ? [status as BookingStatus] : undefined
    // Admin list only: cap rows (?take=). Client and partner keep their full lists.
    const takeRaw = Math.floor(Number(searchParams.get("take")) || 0)
    const take = actor.role === 'ADMIN' && takeRaw > 0 ? Math.min(takeRaw, 1000) : undefined

    const bookings = await bookingsFor(actor, { status: statuses, take })
    if (actor.role !== 'CLIENT') return NextResponse.json(bookings)
    // The client's follow-up buttons (el socio no llegó, ya terminó, buscar otro socio) on recent live bookings
    const recent = Date.now() - 8 * 24 * 3600_000
    const ids = bookings.filter((b) => b.status !== 'COMPLETED' && b.updatedAt.getTime() >= recent).map((b) => b.id)
    const options = await followupOptions(actor, ids).catch(() => ({} as Record<string, string[]>))
    return NextResponse.json(bookings.map((b) => ({ ...b, followupActions: options[b.id] ?? [] })))
  } catch (error) {
    logger.error('Error fetching bookings:', error)
    return NextResponse.json({ error: "Error al obtener reservas" }, { status: 500 })
  }
}

/** Retired: a booking is born from an accepted proposal (POST /api/proposals/[id]/accept). */
export async function POST() {
  return NextResponse.json({ error: 'Esta forma de reservar ya no está disponible. Crea una solicitud y acepta una propuesta.' }, { status: 410 })
}
