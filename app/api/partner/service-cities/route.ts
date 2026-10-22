import { NextResponse } from 'next/server'
import { currentActor } from '@/lib/ops/actor'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * The city of each of the partner's services (and of their profile): the panel compares it with the city of
 * their bookings and proposals and warns when they differ.
 */
export async function GET() {
  const actor = await currentActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (actor.role !== 'PARTNER' || !actor.partnerId) return NextResponse.json({ error: 'Solo socios' }, { status: 403 })

  const partner = await prisma.partnerProfile.findUnique({
    where: { id: actor.partnerId },
    select: { city: true, services: { select: { serviceId: true, city: true, active: true, service: { select: { name: true } } } } },
  })
  if (!partner) return NextResponse.json({ error: 'Perfil de socio no encontrado' }, { status: 404 })

  return NextResponse.json({
    partnerCity: partner.city,
    services: partner.services.map((s) => ({ serviceId: s.serviceId, city: s.city, active: s.active, name: s.service.name })),
  })
}
