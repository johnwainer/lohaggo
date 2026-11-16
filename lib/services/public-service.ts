/**
 * The public data of a service for one city: what its page shows (cards of partners with price, rating and profile
 * link; never phone, email, document numbers nor bank data). One function for the API and for the page itself,
 * which embeds it in the HTML so the content does not wait for a request after hydration.
 */
import { prisma } from '@/lib/prisma'
import { generatePartnerSlug } from '@/lib/slug'

export type PublicServiceResult = { ok: true; data: Record<string, unknown> } | { ok: false; status: 400 | 404; error: string }

export async function loadPublicService(slug: string, citySlug: string): Promise<PublicServiceResult> {
  const cityRecord = await prisma.cityConfig.findUnique({ where: { slug: citySlug } })
  if (!cityRecord) return { ok: false, status: 400, error: 'Ciudad no válida' }

  // City name to its enum value («Medellín» → MEDELLIN)
  const cityEnum = cityRecord.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '_')

  const service = await prisma.service.findUnique({
    where: { slug },
    include: {
      category: true,
      partners: {
        where: {
          active: true,
          // The city the partner offers this service in (a partner may work in several cities)
          city: cityEnum as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          partner: { isActive: true, verified: true, isAvailable: true },
        },
        select: {
          id: true,
          price: true,
          city: true,
          partner: {
            select: {
              id: true, userId: true, city: true, slug: true, bio: true, profileHeadline: true, rating: true, totalReviews: true,
              completedServicesCount: true, verified: true, isAvailable: true, isPublicProfile: true, isCompany: true, companyName: true,
              user: { select: { name: true, image: true } },
              documents: { where: { status: 'APPROVED' }, select: { type: true, status: true } },
            },
          },
        },
      },
    },
  })
  if (!service) return { ok: false, status: 404, error: 'Servicio no encontrado' }

  // Auto-generate slugs for partners that don't have one yet
  const partnersWithoutSlug = service.partners.filter((ps) => !ps.partner.slug)
  if (partnersWithoutSlug.length > 0) {
    await Promise.all(
      partnersWithoutSlug.map(async (ps) => {
        const user = await prisma.user.findUnique({ where: { id: ps.partner.userId }, select: { name: true } })
        const base = generatePartnerSlug(user?.name ?? 'socio', ps.partner.city)
        let candidate = base
        let attempt = 0
        while (true) {
          const exists = await prisma.partnerProfile.findUnique({ where: { slug: candidate } })
          if (!exists || exists.id === ps.partner.id) break
          attempt++
          candidate = `${base}-${attempt}`
        }
        const updated = await prisma.partnerProfile.update({ where: { id: ps.partner.id }, data: { slug: candidate } })
        ps.partner.slug = updated.slug
      }),
    )
  }

  return {
    ok: true,
    data: {
      ...service,
      partners: service.partners.map(({ partner: { userId: _userId, city: _city, ...partner }, ...ps }) => ({ ...ps, partner })),
    },
  }
}
