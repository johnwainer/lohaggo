import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
                phone: true,
                email: true
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
    console.error('Error fetching favorites:', error)
    return NextResponse.json(
      { error: 'Error fetching favorites' },
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

    const { partnerId } = await req.json()

    if (!partnerId) {
      return NextResponse.json({ error: 'Partner ID is required' }, { status: 400 })
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
      return NextResponse.json({ error: 'Partner already in favorites' }, { status: 400 })
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
                name: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(favorite, { status: 201 })
  } catch (error: any) {
    console.error('Error adding favorite:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    })
    return NextResponse.json(
      { error: 'Error adding favorite', details: error?.message },
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
    const partnerId = searchParams.get('partnerId')

    if (!partnerId) {
      return NextResponse.json({ error: 'Partner ID is required' }, { status: 400 })
    }

    await prisma.favoritePartner.delete({
      where: {
        userId_partnerId: {
          userId: session.user.id,
          partnerId
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing favorite:', error)
    return NextResponse.json(
      { error: 'Error removing favorite' },
      { status: 500 }
    )
  }
}
