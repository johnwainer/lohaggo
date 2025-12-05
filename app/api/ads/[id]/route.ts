import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const logger = createLogger('ads-id')

const adUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional().nullable(),
  placement: z.enum(['HOME', 'SERVICE']).optional(),
  serviceId: z.string().optional().nullable(),
  cityId: z.string().min(1).optional(),
  active: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  priority: z.number().int().min(0).max(100).optional()
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const ad = await prisma.advertisement.findUnique({
      where: { id },
      include: {
        service: true,
        city: true
      }
    })

    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    return NextResponse.json(ad)
  } catch (error) {
    logger.error('Error fetching ad:', error || undefined)
    return NextResponse.json({ error: 'Error fetching ad' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
    const body = await request.json()

    const validation = adUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { title, imageUrl, linkUrl, placement, serviceId, cityId, active, startDate, endDate, priority } = validation.data

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl
    if (linkUrl !== undefined) updateData.linkUrl = linkUrl
    if (placement !== undefined) {
      updateData.placement = placement
      if (placement === 'SERVICE' && !serviceId) {
        return NextResponse.json(
          { error: 'serviceId is required when placement is SERVICE' },
          { status: 400 }
        )
      }
      if (placement === 'HOME') {
        updateData.serviceId = null
      }
    }
    if (serviceId !== undefined) updateData.serviceId = serviceId
    if (cityId !== undefined) updateData.cityId = cityId
    if (active !== undefined) updateData.active = active
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (priority !== undefined) updateData.priority = priority

    const ad = await prisma.advertisement.update({
      where: { id },
      data: updateData,
      include: {
        service: true,
        city: true
      }
    })

    return NextResponse.json(ad)
  } catch (error) {
    logger.error('Error updating ad:', error || undefined)
    return NextResponse.json({ error: 'Error updating ad' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params

    await prisma.advertisement.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Ad deleted successfully' })
  } catch (error) {
    logger.error('Error deleting ad:', error || undefined)
    return NextResponse.json({ error: 'Error deleting ad' }, { status: 500 })
  }
}
