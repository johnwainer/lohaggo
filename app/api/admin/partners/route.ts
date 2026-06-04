import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'


const logger = createLogger('admin-partners')

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const partners = await prisma.partnerProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            image: true,
            createdAt: true,
            excludedFromMarketing: true,
          }
        },
        services: {
          include: {
            service: {
              select: {
                name: true,
                icon: true,
              }
            }
          }
        },
        _count: {
          select: {
            bookings: true,
            proposals: true,
          }
        },
        bankAccounts: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: {
            id: true,
            bankName: true,
            accountType: true,
            accountNumber: true,
            isDefault: true,
            mercadoPagoRecipientId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(partners)
  } catch (error) {
    logger.error('Error fetching partners:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener socios' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { partnerId, verified } = body

    const partner = await prisma.partnerProfile.update({
      where: { id: partnerId },
      data: { verified }
    })

    return NextResponse.json(partner)
  } catch (error) {
    logger.error('Error updating partner:', error || undefined)
    return NextResponse.json({ error: 'Error al actualizar socio' }, { status: 500 })
  }
}
