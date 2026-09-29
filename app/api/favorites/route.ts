import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('favorites')

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const favorites = await prisma.favoritePartner.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        partner: {
          include: {
            user: {
              select: {
                name: true,
                image: true
              }
            },
            services: {
              where: {
                active: true
              },
              include: {
                service: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    icon: true
                  }
                }
              }
            },
            documents: {
              select: {
                type: true,
                status: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(favorites)
  } catch (error) {
    logger.error('Error fetching favorites:', error || undefined)
    return NextResponse.json(
      { error: 'No pudimos cargar tus favoritos' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { partnerId } = body

    if (!partnerId) {
      return NextResponse.json(
        { error: 'Falta el socio' },
        { status: 400 }
      )
    }

    const partner = await prisma.partnerProfile.findUnique({
      where: { id: partnerId }
    })

    if (!partner) {
      return NextResponse.json(
        { error: 'Socio no encontrado' },
        { status: 404 }
      )
    }

    const existingFavorite = await prisma.favoritePartner.findUnique({
      where: {
        userId_partnerId: {
          userId: session.user.id,
          partnerId
        }
      }
    })

    if (existingFavorite) {
      return NextResponse.json(
        { error: 'Este socio ya está en tus favoritos' },
        { status: 400 }
      )
    }

    const favorite = await prisma.favoritePartner.create({
      data: {
        userId: session.user.id,
        partnerId
      },
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
    })

    return NextResponse.json(favorite, { status: 201 })
  } catch (error) {
    logger.error('Error adding favorite:', error || undefined)
    return NextResponse.json(
      { error: 'No pudimos agregar el favorito' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const partnerId = searchParams.get('partnerId')

    if (!partnerId) {
      return NextResponse.json({ error: 'Falta el socio' }, { status: 400 })
    }

    await prisma.favoritePartner.delete({
      where: {
        userId_partnerId: {
          userId: session.user.id,
          partnerId
        }
      }
    })

    return NextResponse.json({ message: 'Favorito eliminado' })
  } catch (error) {
    logger.error('Error removing favorite:', error || undefined)
    return NextResponse.json(
      { error: 'No pudimos quitar el favorito' },
      { status: 500 }
    )
  }
}
