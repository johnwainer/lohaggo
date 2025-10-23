import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyNewServiceRequest } from '@/lib/notifications/notificationService'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()

    if (!body.serviceId || !body.address) {
      return NextResponse.json({ error: 'Servicio y dirección son requeridos' }, { status: 400 })
    }

    if (!body.isUrgent && !body.preferredDate) {
      return NextResponse.json({ error: 'Debes indicar si necesitas el servicio urgente o seleccionar una fecha' }, { status: 400 })
    }

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        userId: session.user.id,
        serviceId: body.serviceId,
        address: body.address,
        notes: body.notes || null,
        city: body.city || 'MEDELLIN',
        preferredDate: body.preferredDate ? new Date(body.preferredDate) : null,
        preferredTime: body.preferredTime || null,
        isUrgent: body.isUrgent || false,
        status: 'ACTIVE',
        expiresAt: expiresAt,
        photos: body.photoUrls && body.photoUrls.length > 0 ? {
          create: body.photoUrls.map((url: string, index: number) => ({
            url,
            order: index
          }))
        } : undefined
      },
      include: {
        service: {
          include: {
            category: true
          }
        },
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        photos: true
      }
    })

    await notifyNewServiceRequest(serviceRequest.id)

    return NextResponse.json(serviceRequest, { status: 201 })
  } catch (error) {
    console.error('Error creating service request:', error)
    return NextResponse.json(
      { error: 'Error al crear la solicitud de servicio' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        service: {
          include: {
            category: true
          }
        },
        proposals: {
          include: {
            partner: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                    phone: true
                  }
                }
              }
            }
          }
        },
        photos: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(serviceRequests)
  } catch (error) {
    console.error('Error fetching service requests:', error)
    return NextResponse.json(
      { error: 'Error al obtener las solicitudes' },
      { status: 500 }
    )
  }
}
