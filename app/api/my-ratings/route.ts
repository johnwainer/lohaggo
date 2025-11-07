import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'


const logger = createLogger('my-ratings')

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    let reviews

    if (user.role === 'CLIENT') {
      // Obtener calificaciones que los socios le han dado al cliente
      reviews = await prisma.review.findMany({
        where: {
          booking: {
            userId: user.id
          },
          partnerToClientRating: {
            not: null
          }
        },
        include: {
          booking: {
            include: {
              service: {
                select: {
                  name: true,
                  icon: true
                }
              },
              user: {
                select: {
                  name: true,
                  email: true
                }
              },
              partner: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          partnerReviewedAt: 'desc'
        }
      })
    } else if (user.role === 'PARTNER') {
      // Obtener calificaciones que los clientes le han dado al socio
      reviews = await prisma.review.findMany({
        where: {
          booking: {
            partner: {
              userId: user.id
            }
          },
          clientToPartnerRating: {
            not: null
          }
        },
        include: {
          booking: {
            include: {
              service: {
                select: {
                  name: true,
                  icon: true
                }
              },
              user: {
                select: {
                  name: true,
                  email: true
                }
              },
              partner: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          clientReviewedAt: 'desc'
        }
      })
    } else {
      return NextResponse.json({ error: 'Rol de usuario no válido' }, { status: 400 })
    }

    return NextResponse.json({
      reviews,
      userRole: user.role
    })
  } catch (error) {
    logger.error('Error fetching user ratings:', error)
    return NextResponse.json(
      { error: 'Error al obtener las calificaciones' },
      { status: 500 }
    )
  }
}
