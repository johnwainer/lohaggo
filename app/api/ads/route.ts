import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const logger = createLogger('ads')

const adCreateSchema = z.object({
  title: z.string().min(1).max(200),
  imageUrl: z.string().url(),
  linkUrl: z.string().url().optional().nullable(),
  placement: z.enum(['HOME', 'SERVICE']),
  serviceId: z.string().optional().nullable(),
  cityId: z.string().min(1),
  active: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  priority: z.number().int().min(0).max(100).optional()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const placement = searchParams.get('placement')
    const serviceId = searchParams.get('serviceId')
    const citySlug = searchParams.get('city')
    const isAdmin = searchParams.get('admin') === 'true'

    const where: any = {}

    if (!isAdmin) {
      where.active = true
      where.startDate = { lte: new Date() }
      where.OR = [
        { endDate: null },
        { endDate: { gte: new Date() } }
      ]
    }

    if (placement) {
      where.placement = placement
    }

    if (serviceId) {
      where.serviceId = serviceId
    }

    if (citySlug) {
      where.city = {
        slug: citySlug.toLowerCase()
      }
    }

    const ads = await prisma.advertisement.findMany({
      where,
      include: {
        service: true,
        city: true
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(ads)
  } catch (error) {
    logger.error('Error fetching ads:', error || undefined)
    return NextResponse.json({ error: 'Error fetching ads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! }
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const validation = adCreateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { title, imageUrl, linkUrl, placement, serviceId, cityId, active, startDate, endDate, priority } = validation.data

    if (placement === 'SERVICE' && !serviceId) {
      return NextResponse.json(
        { error: 'serviceId is required when placement is SERVICE' },
        { status: 400 }
      )
    }

    const ad = await prisma.advertisement.create({
      data: {
        title,
        imageUrl,
        linkUrl,
        placement,
        serviceId: placement === 'SERVICE' ? serviceId : null,
        cityId,
        active: active ?? true,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        priority: priority ?? 0
      },
      include: {
        service: true,
        city: true
      }
    })

    return NextResponse.json(ad, { status: 201 })
  } catch (error) {
    logger.error('Error creating ad:', error || undefined)
    return NextResponse.json({ error: 'Error creating ad' }, { status: 500 })
  }
}
