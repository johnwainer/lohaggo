/**
 * The partner's public profile as something to share: its link (tagged so analytics can tell which visits
 * and requests came from partners sharing it) and its address, created from the name when missing.
 */
import { prisma } from '@/lib/prisma'
import { generatePartnerSlug } from '@/lib/slug'

export { PROFILE_BASE, shareQuery, partnerShareUrl, type ShareMedium } from '@/lib/partners/share-url'

/** A free address: the base, or the base with -1, -2… */
export async function uniquePartnerSlug(base: string, excludeId: string): Promise<string> {
  const clean = base || 'socio'
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = attempt === 0 ? clean : `${clean}-${attempt}`
    const existing = await prisma.partnerProfile.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!existing || existing.id === excludeId) return candidate
  }
  return `${clean}-${excludeId.slice(-6)}`
}

/** The partner's profile address, created from their name and city the first time it is needed. */
export async function ensurePartnerSlug(partner: { id: string; slug: string | null; city: string; userName: string | null }): Promise<string> {
  if (partner.slug) return partner.slug
  const slug = await uniquePartnerSlug(generatePartnerSlug(partner.userName ?? 'socio', partner.city), partner.id)
  await prisma.partnerProfile.update({ where: { id: partner.id }, data: { slug } })
  return slug
}
