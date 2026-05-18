import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

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
      clientRating: true,
      clientTotalReviews: true,
      completedServicesCount: true,
      addresses: {
        where: { isActive: true },
        select: { label: true, street: true, neighborhood: true, city: true, isPrimary: true },
        take: 3,
      },
      partnerProfile: {
        select: {
          bio: true,
          rating: true,
          totalReviews: true,
          completedServicesCount: true,
          verified: true,
          isActive: true,
          isAvailable: true,
          city: true,
          profileHeadline: true,
          slug: true,
          services: {
            where: { active: true },
            select: { service: { select: { name: true } } },
            take: 10,
          },
          documents: {
            select: { type: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          bankAccounts: {
            where: { isActive: true },
            select: { bankName: true, accountType: true, accountHolderName: true, isDefault: true },
            take: 3,
          },
        },
      },
      bookings: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          totalPrice: true,
          scheduledDate: true,
          scheduledTime: true,
          createdAt: true,
          service: { select: { name: true } },
        },
      },
      _count: {
        select: {
          bookings: true,
          serviceRequests: true,
          payments: true,
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ user })
}
