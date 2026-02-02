import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const logger = createLogger('admin-cities')

const cityCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  status: z.enum(['ACTIVE', 'INACTIVE', 'COMING_SOON']).optional(),
  order: z.number().int().min(0).optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isLaunched: z.boolean().optional(),
  launchDate: z.string().datetime().optional().nullable(),
  partnerRegistry: z.boolean().optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cities = await prisma.cityConfig.findMany({
      orderBy: { order: 'asc' }
    })

    return NextResponse.json(cities)
  } catch (error) {
    logger.error('Error fetching cities:', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const validation = cityCreateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { name, slug, status, order, latitude, longitude, isLaunched, launchDate, partnerRegistry } = validation.data

    const city = await prisma.cityConfig.create({
      data: {
        name,
        slug,
        status: status ?? 'ACTIVE',
        order: order ?? 0,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        isLaunched: isLaunched ?? false,
        launchDate: launchDate ? new Date(launchDate) : null,
        partnerRegistry: partnerRegistry ?? false
      }
    })

    return NextResponse.json(city, { status: 201 })
  } catch (error) {
    logger.error('Error creating city:', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
