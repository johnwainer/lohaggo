import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  const { slug } = await context.params

  const partner = await prisma.partnerProfile.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true, image: true } },
      services: {
        where: { active: true },
        include: { service: { select: { name: true, icon: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
        take: 12,
      },
      workPhotos: { orderBy: { order: 'asc' }, take: 12 },
      achievements: {
        include: { achievement: { select: { name: true, icon: true, type: true } } },
        orderBy: { unlockedAt: 'desc' },
      },
    },
  })

  if (!partner || !partner.isPublicProfile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const reviews = await prisma.review.findMany({
    where: {
      clientToPartnerRating: { not: null },
      booking: { partnerId: partner.id },
    },
    include: {
      booking: {
        select: {
          user: { select: { name: true, image: true } },
          service: { select: { name: true } },
        },
      },
    },
    orderBy: { clientReviewedAt: 'desc' },
    take: 8,
  })

  return NextResponse.json({
    partner: {
      id: partner.id,
      slug: partner.slug,
      name: partner.user.name,
      image: partner.user.image,
      city: partner.city,
      bio: partner.bio,
      profileHeadline: partner.profileHeadline,
      isAvailable: partner.isAvailable,
      rating: partner.rating,
      totalReviews: partner.totalReviews,
      completedServicesCount: partner.completedServicesCount,
      verified: partner.verified,
      createdAt: partner.createdAt,
      services: partner.services.map((ps) => ({
        id: ps.id,
        name: ps.service.name,
        icon: ps.service.icon,
        slug: ps.service.slug,
        price: ps.price,
      })),
      workPhotos: partner.workPhotos.map((p) => ({
        id: p.id,
        url: p.url,
        caption: p.caption,
        order: p.order,
      })),
      achievements: partner.achievements.map((pa) => ({
        id: pa.id,
        name: pa.achievement.name,
        icon: pa.achievement.icon,
        type: pa.achievement.type,
        unlockedAt: pa.unlockedAt,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.clientToPartnerRating,
        comment: r.clientToPartnerComment,
        reviewedAt: r.clientReviewedAt,
        service: r.booking.service?.name ?? null,
        reviewer: {
          name: r.booking.user?.name ?? 'Cliente',
          image: r.booking.user?.image ?? null,
        },
      })),
    },
  })
}
