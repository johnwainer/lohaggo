import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { removePartnerService, upsertPartnerService } from '@/lib/partners/ops'
import { APP_ORIGIN, OpsError, type Actor } from '@/lib/ops/origin'

export const dynamic = 'force-dynamic'

const logger = createLogger('partner-services')

async function sessionActor(): Promise<Actor | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return { userId: session.user.id, role: session.user.role as Actor['role'], email: session.user.email ?? null }
}

function fail(error: unknown, fallback: string) {
  if (error instanceof OpsError) return NextResponse.json({ error: error.message }, { status: error.status })
  logger.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

// GET - the whole catalog, marking the services this partner offers
export async function GET() {
  try {
    const actor = await sessionActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: actor.userId },
      include: {
        services: {
          include: {
            service: { include: { category: true } },
            documents: { where: { status: 'APPROVED' }, select: { id: true, type: true, status: true } },
          },
        },
      },
    })
    if (!partnerProfile) return NextResponse.json({ error: 'Perfil de partner no encontrado' }, { status: 404 })

    const allServices = await prisma.service.findMany({ include: { category: true }, orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }] })

    const servicesWithStatus = allServices.map((service) => {
      const partnerService = partnerProfile.services.find((ps) => ps.serviceId === service.id)
      return {
        ...service,
        isActive: !!partnerService,
        partnerServiceId: partnerService?.id,
        price: partnerService?.price || service.basePrice,
        city: partnerService?.city,
        approvedDocuments: partnerService?.documents ?? [],
      }
    })

    return NextResponse.json({ services: servicesWithStatus, partnerId: partnerProfile.id })
  } catch (error) {
    return fail(error, 'Error al obtener servicios')
  }
}

// POST - add a service (or update it when the partner already offers it)
export async function POST(req: NextRequest) {
  try {
    const actor = await sessionActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { serviceId, price, city, active } = await req.json()
    if (!serviceId) return NextResponse.json({ error: 'serviceId requerido' }, { status: 400 })
    const partnerService = await upsertPartnerService(actor, { serviceId, price, city, active }, APP_ORIGIN)
    return NextResponse.json(partnerService)
  } catch (error) {
    return fail(error, 'Error al guardar servicio')
  }
}

// PATCH - price and city of one of the partner's services
export async function PATCH(req: NextRequest) {
  try {
    const actor = await sessionActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { partnerServiceId, price, city } = await req.json()
    if (!partnerServiceId) return NextResponse.json({ error: 'partnerServiceId requerido' }, { status: 400 })
    const updated = await upsertPartnerService(actor, { partnerServiceId, price, city }, APP_ORIGIN)
    return NextResponse.json(updated)
  } catch (error) {
    return fail(error, 'Error al actualizar servicio')
  }
}

// DELETE - remove one of the partner's services (availability goes by cascade)
export async function DELETE(req: NextRequest) {
  try {
    const actor = await sessionActor()
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { partnerServiceId } = await req.json()
    if (!partnerServiceId) return NextResponse.json({ error: 'ID de servicio requerido' }, { status: 400 })
    return NextResponse.json(await removePartnerService(actor, partnerServiceId))
  } catch (error) {
    return fail(error, 'Error al eliminar servicio')
  }
}
