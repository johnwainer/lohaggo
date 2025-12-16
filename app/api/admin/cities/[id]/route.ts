import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const logger = createLogger('admin-cities-id')

const cityUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'COMING_SOON']).optional(),
  order: z.number().int().min(0).optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  lanzamiento: z.boolean().optional(),
  fechaLanzamiento: z.string().datetime().optional().nullable()
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const validation = cityUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { name, slug, status, order, latitude, longitude, lanzamiento, fechaLanzamiento } = validation.data

    const city = await prisma.cityConfig.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(status && { status }),
        ...(order !== undefined && { order }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(lanzamiento !== undefined && { lanzamiento }),
        ...(fechaLanzamiento !== undefined && { fechaLanzamiento: fechaLanzamiento ? new Date(fechaLanzamiento) : null })
      }
    })

    return NextResponse.json(city)
  } catch (error) {
    logger.error('Error updating city:', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.cityConfig.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'City deleted successfully' })
  } catch (error) {
    logger.error('Error deleting city:', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}