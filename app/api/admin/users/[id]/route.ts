import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { normalizePhone } from '@/lib/phone'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      clientRating: true,
      clientTotalReviews: true,
      completedServicesCount: true,
      notificationsPushEnabled: true,
      notificationsEmailEnabled: true,
      notificationsWhatsappEnabled: true,
      notificationsSmsEnabled: true,
      mercadopagoCustomerId: true,
      addresses: {
        orderBy: { isPrimary: 'desc' },
        select: {
          id: true,
          label: true,
          street: true,
          number: true,
          complement: true,
          neighborhood: true,
          city: true,
          postalCode: true,
          instructions: true,
          isPrimary: true,
          isActive: true,
        },
      },
      bookings: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          status: true,
          totalPrice: true,
          scheduledDate: true,
          scheduledTime: true,
          address: true,
          city: true,
          notes: true,
          createdAt: true,
          clientCommissionRate: true,
          partnerCommissionRate: true,
          service: { select: { id: true, name: true } },
          partner: {
            select: {
              id: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          payment: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              paidAt: true,
              paymentMethodType: true,
              mercadopagoId: true,
            },
          },
          review: {
            select: {
              clientToPartnerRating: true,
              clientToPartnerComment: true,
              partnerToClientRating: true,
              partnerToClientComment: true,
              clientReviewedAt: true,
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          amount: true,
          totalAmount: true,
          status: true,
          paymentMethodType: true,
          paidAt: true,
          createdAt: true,
          mercadopagoId: true,
          booking: { select: { id: true, service: { select: { name: true } } } },
        },
      },
      conversations: {
        orderBy: { lastMessageAt: 'desc' },
        take: 20,
        select: {
          id: true,
          channel: true,
          contactPhone: true,
          status: true,
          tags: true,
          lastMessageAt: true,
          lastMessageBody: true,
          unreadCount: true,
          createdAt: true,
          _count: { select: { messages: true } },
          messages: {
            where: { isInternal: true },
            orderBy: { sentAt: 'desc' },
            select: {
              id: true,
              body: true,
              sentAt: true,
              sentBy: { select: { id: true, name: true } },
            },
          },
        },
      },
      messagingOptOuts: {
        select: { id: true, channel: true, destination: true, isActive: true, createdAt: true },
      },
      supportCases: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          subject: true,
          priority: true,
          status: true,
          queue: true,
          createdAt: true,
          resolvedAt: true,
          resolutionNote: true,
        },
      },
      fraudSignals: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, type: true, severity: true, reason: true, details: true, status: true, createdAt: true },
      },
      magicTokens: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          redirectUrl: true,
          expiresAt: true,
          usedAt: true,
          createdAt: true,
        },
      },
      partnerProfile: {
        select: {
          id: true,
          bio: true,
          rating: true,
          totalReviews: true,
          completedServicesCount: true,
          isActive: true,
          isAvailable: true,
          verified: true,
          city: true,
          slug: true,
          profileHeadline: true,
          isPublicProfile: true,
          createdAt: true,
          services: {
            include: {
              service: { select: { id: true, name: true } },
              documents: {
                select: { id: true, type: true, status: true, rejectionReason: true, createdAt: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          documents: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              type: true,
              documentUrl: true,
              status: true,
              rejectionReason: true,
              reviewedAt: true,
              createdAt: true,
            },
          },
          bankAccounts: {
            orderBy: { isDefault: 'desc' },
            select: {
              id: true,
              bankName: true,
              accountType: true,
              accountNumber: true,
              accountHolderName: true,
              holderDocumentType: true,
              holderDocumentNumber: true,
              isDefault: true,
              isActive: true,
              verifiedAt: true,
              createdAt: true,
            },
          },
          bookings: {
            orderBy: { createdAt: 'desc' },
            take: 30,
            select: {
              id: true,
              status: true,
              totalPrice: true,
              scheduledDate: true,
              scheduledTime: true,
              city: true,
              createdAt: true,
              service: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true } },
              payment: { select: { id: true, status: true, totalAmount: true, paidAt: true } },
            },
          },
          payouts: {
            orderBy: { createdAt: 'desc' },
            take: 30,
            select: {
              id: true,
              amount: true,
              netAmount: true,
              partnerCommission: true,
              partnerCommissionRate: true,
              status: true,
              processedAt: true,
              createdAt: true,
              payment: { select: { booking: { select: { service: { select: { name: true } } } } } },
            },
          },
          achievements: {
            include: { achievement: { select: { name: true, description: true, icon: true } } },
            orderBy: { unlockedAt: 'desc' },
          },
          workPhotos: {
            orderBy: { order: 'asc' },
            select: { id: true, url: true, caption: true },
          },
        },
      },
      _count: {
        select: {
          bookings: true,
          payments: true,
          serviceRequests: true,
          conversations: true,
          supportCases: true,
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ user })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const body = await request.json()

  const data: Record<string, unknown> = {}
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
  if (body.name !== undefined) data.name = String(body.name).trim()
  if (body.phone !== undefined) data.phone = normalizePhone(body.phone) ?? null
  if (body.notes !== undefined) data.notes = body.notes

  const user = await prisma.user.update({ where: { id }, data, select: { id: true, isActive: true, name: true } })
  return NextResponse.json({ user })
}
