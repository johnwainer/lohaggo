import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-services-id')

const serviceUpdateSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().min(4).max(1000),
  icon: z.string().min(1).max(8),
  categoryId: z.string().min(1),
  basePrice: z.number().positive(),
  duration: z.number().int().positive().max(1440),
  popular: z.boolean(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const parsed = serviceUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const updated = await prisma.service.update({
      where: { id },
      data: parsed.data,
      include: {
        category: { select: { id: true, name: true, icon: true, slug: true } },
        _count: { select: { partners: true, bookings: true } },
      },
    })

    return NextResponse.json({ service: updated })
  } catch (error: any) {
    logger.error('Error updating service', error || undefined)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug ya existe.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const usage = await prisma.service.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            bookings: true,
            partners: true,
            serviceRequests: true,
            favoritedBy: true,
            advertisements: true,
          },
        },
      },
    })

    if (!usage) {
      return NextResponse.json({ error: 'Servicio no encontrado.' }, { status: 404 })
    }

    const blockers = usage._count.bookings + usage._count.partners + usage._count.serviceRequests + usage._count.favoritedBy + usage._count.advertisements
    if (blockers > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar: el servicio tiene reservas, socios, solicitudes u otras relaciones activas.' },
        { status: 400 }
      )
    }

    await prisma.service.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Error deleting service', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
