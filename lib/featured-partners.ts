import { prisma } from '@/lib/prisma'

export type FeaturedPartner = {
  slug: string
  name: string
  image: string | null
  city: string
  profileHeadline: string | null
  rating: number
  totalReviews: number
  completedServicesCount: number
  services: Array<{ name: string; icon: string | null; slug: string }>
}

export async function getFeaturedPartners(): Promise<FeaturedPartner[]> {
  const candidates = await prisma.partnerProfile.findMany({
    where: {
      verified: true,
      isPublicProfile: true,
      isActive: true,
      slug: { not: null },
      services: { some: { active: true } },
    },
    include: {
      user: { select: { name: true, image: true } },
      services: {
        where: { active: true },
        include: { service: { select: { name: true, icon: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
        take: 3,
      },
    },
    take: 30,
  })

  return candidates
    .map((p) => ({
      p,
      score:
        (p.rating ?? 0) * Math.log10((p.totalReviews ?? 0) + 10) +
        Math.min(p.completedServicesCount ?? 0, 50) * 0.05,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.p.completedServicesCount !== a.p.completedServicesCount) {
        return (b.p.completedServicesCount ?? 0) - (a.p.completedServicesCount ?? 0)
      }
      return a.p.createdAt.getTime() - b.p.createdAt.getTime()
    })
    .slice(0, 8)
    .map(({ p }) => ({
      slug: p.slug as string,
      name: p.user.name,
      image: p.user.image,
      city: p.city,
      profileHeadline: p.profileHeadline,
      rating: p.rating,
      totalReviews: p.totalReviews,
      completedServicesCount: p.completedServicesCount,
      services: p.services.map((ps) => ({
        name: ps.service.name,
        icon: ps.service.icon,
        slug: ps.service.slug,
      })),
    }))
}
