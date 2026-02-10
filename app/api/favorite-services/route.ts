import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('favorite-services')

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const favoriteServices = await prisma.favoriteService.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        service: {
          include: {
            category: {
              select: {
                name: true,
                slug: true,
                icon: true
              }
            },
            partners: {
              where: {
                active: true
              },
              take: 3,
              include: {
                partner: {
                  include: {
                    user: {
                      select: {
                        name: true,
                        image: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(favoriteServices)
  } catch (error) {
    logger.error('Error fetching favorite services:', error || undefined)
    return NextResponse.json(
      { error: 'Error fetching favorite services' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { serviceId } = body

    if (!serviceId) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    })

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    const existingFavorite = await prisma.favoriteService.findUnique({
      where: {
        userId_serviceId: {
          userId: session.user.id,
          serviceId: serviceId
        }
      }
    })

    if (existingFavorite) {
      return NextResponse.json(
        { error: 'Service already in favorites' },
        { status: 400 }
      )
    }

    const favoriteService = await prisma.favoriteService.create({
      data: {
        userId: session.user.id,
        serviceId: serviceId
      },
      include: {
        service: {
          include: {
            category: true
          }
        }
      }
    })

    logger.info('Favorite service added', {
      userId: session.user.id,
      serviceId: serviceId
    })

    return NextResponse.json(favoriteService, { status: 201 })
  } catch (error) {
    logger.error('Error adding favorite service:', error || undefined)
    return NextResponse.json(
      { error: 'Error adding favorite service' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const serviceId = searchParams.get('serviceId')

    if (!serviceId) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }

    const existingFavorite = await prisma.favoriteService.findUnique({
      where: {
        userId_serviceId: {
          userId: session.user.id,
          serviceId: serviceId
        }
      }
    })

    if (!existingFavorite) {
      return NextResponse.json(
        { error: 'Favorite service not found' },
        { status: 404 }
      )
    }

    await prisma.favoriteService.delete({
      where: {
        id: existingFavorite.id
      }
    })

    logger.info('Favorite service removed', {
      userId: session.user.id,
      serviceId: serviceId
    })

    return NextResponse.json({ message: 'Favorite service removed successfully' })
  } catch (error) {
    logger.error('Error removing favorite service:', error || undefined)
    return NextResponse.json(
      { error: 'Error removing favorite service' },
      { status: 500 }
    )
  }
}
