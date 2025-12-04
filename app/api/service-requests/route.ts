import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyNewServiceRequest } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'
import { serviceRequestSchema, validateRequest } from '@/lib/validation'
import { City } from '@prisma/client'
import { handleApiError } from '@/lib/errors'

export const dynamic = 'force-dynamic'


const logger = createLogger('service-requests')

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()

    const validation = await validateRequest(serviceRequestSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const validatedData = validation.data

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    let preferredDateTime: Date | null = null
    if (validatedData.preferredDate) {
      if (validatedData.preferredTime) {
        const [hours, minutes] = validatedData.preferredTime.split(':').map(Number)
        preferredDateTime = new Date(validatedData.preferredDate)
        preferredDateTime.setHours(hours, minutes, 0, 0)
      } else {
        preferredDateTime = new Date(validatedData.preferredDate)
      }
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        userId: session.user.id,
        serviceId: validatedData.serviceId,
        partnerId: validatedData.partnerId || null,
        address: validatedData.address,
        notes: validatedData.notes || null,
        city: (validatedData.city as City) || City.MEDELLIN,
        preferredDate: preferredDateTime,
        preferredTime: validatedData.preferredTime || null,
        isUrgent: validatedData.isUrgent || false,
        status: 'ACTIVE',
        expiresAt: expiresAt,
        photos: validatedData.photoUrls && validatedData.photoUrls.length > 0 ? {
          create: validatedData.photoUrls.map((url: string, index: number) => ({
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
    return handleApiError(error, 'service-requests-create')
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const [serviceRequests, platformConfig] = await Promise.all([
      prisma.serviceRequest.findMany({
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
                  },
                  documents: {
                    where: {
                      status: 'APPROVED'
                    },
                    select: {
                      type: true,
                      status: true
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
      }),
      prisma.platformConfig.findFirst({
        orderBy: {
          createdAt: 'asc'
        }
      })
    ])

    let clientCommissionRate = 5.0

    if (platformConfig) {
      clientCommissionRate = platformConfig.clientCommissionRate
    } else {
      const newConfig = await prisma.platformConfig.create({
        data: {
          key: 'default',
          commissionRate: 15.0,
          clientCommissionRate: 5.0,
          partnerCommissionRate: 20.0,
          minServicePrice: 10000,
          maxServicePrice: 10000000,
        }
      })
      clientCommissionRate = newConfig.clientCommissionRate
    }

    return NextResponse.json({
      serviceRequests,
      clientCommissionRate
    })
  } catch (error) {
    return handleApiError(error, 'service-requests-get')
  }
}
