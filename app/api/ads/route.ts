import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const placement = searchParams.get('placement')
    const serviceId = searchParams.get('serviceId')
    const city = searchParams.get('city')

    const where: any = {
      active: true,
      startDate: { lte: new Date() },
      OR: [
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

    if (city) {
      where.city = city
    }

    const ads = await prisma.advertisement.findMany({
      where,
      include: {
        service: true
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(ads)
  } catch (error) {
    console.error('Error fetching ads:', error)
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
    const { title, imageUrl, linkUrl, placement, serviceId, city, active, startDate, endDate, priority } = body

    if (!title || !imageUrl || !placement || !city) {
      return NextResponse.json(
        { error: 'Missing required fields: title, imageUrl, placement, city' },
        { status: 400 }
      )
    }

    // Validate serviceId is provided when placement is SERVICE
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
        city,
        active: active ?? true,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        priority: priority ?? 0
      },
      include: {
        service: true
      }
    })

    return NextResponse.json(ad, { status: 201 })
  } catch (error) {
    console.error('Error creating ad:', error)
    return NextResponse.json({ error: 'Error creating ad' }, { status: 500 })
  }
}
