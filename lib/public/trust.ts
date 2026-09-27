/**
 * Server side of the public claims: the switches (FeatureFlag rows, created with their default the first
 * time) and the real numbers behind every statement, cached for a few minutes. Public pages read
 * `getPublicTrust()`; Haggo reads the same thing plus `unbackedClaims`.
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { CLAIMS, CLAIM_KEYS, defaultClaimState, STAT_MINIMUMS, showStat, unbackedClaims, type ClaimKey, type ClaimState, type TrustFacts } from '@/lib/public/claims'

export const TRUST_CACHE_TAG = 'public-trust'

/** Creates the missing claim flags with their defaults; returns the current state. */
export async function getClaimState(): Promise<ClaimState> {
  const rows = await prisma.featureFlag.findMany({ where: { key: { in: CLAIM_KEYS } }, select: { key: true, enabled: true } })
  const state = defaultClaimState()
  const have = new Set(rows.map((r) => r.key))
  for (const r of rows) state[r.key as ClaimKey] = r.enabled
  const missing = CLAIM_KEYS.filter((k) => !have.has(k))
  if (missing.length) {
    await prisma.featureFlag.createMany({
      data: missing.map((k) => ({ key: k, name: CLAIMS[k].name, description: `${CLAIMS[k].says} Requiere: ${CLAIMS[k].requires}`, enabled: CLAIMS[k].defaultOn })),
      skipDuplicates: true,
    }).catch(() => null)
  }
  return state
}

export async function getTrustFacts(): Promise<TrustFacts> {
  const [verifiedPartners, completedServices, clients, rating, cities, services, config, agents, backgroundRule] = await Promise.all([
    prisma.partnerProfile.count({ where: { verified: true, isActive: true } }),
    prisma.booking.count({ where: { status: 'COMPLETED' } }),
    prisma.user.count({ where: { role: 'CLIENT', isActive: true } }),
    prisma.review.aggregate({ where: { clientToPartnerRating: { not: null } }, _avg: { clientToPartnerRating: true }, _count: { clientToPartnerRating: true } }),
    prisma.cityConfig.findMany({ where: { status: 'ACTIVE' }, select: { name: true } }),
    prisma.service.count({ where: { partners: { some: { active: true, partner: { verified: true, isActive: true } } } } }),
    prisma.platformConfig.findFirst({ where: { key: 'default' } }).then((c) => c ?? prisma.platformConfig.findFirst()),
    prisma.aiAgent.count({ where: { status: 'active', autopilot: true, autopilotChannels: { has: 'WHATSAPP' } } }),
    // Verification today needs only an identity document (lib: app/api/admin/documents/review). If that
    // ever changes, flip this to read the rule instead.
    Promise.resolve(false),
  ])
  return {
    verifiedPartners,
    completedServices,
    clients,
    reviews: rating._count.clientToPartnerRating,
    avgRating: rating._avg.clientToPartnerRating ? Math.round(rating._avg.clientToPartnerRating * 10) / 10 : null,
    activeCities: cities.map((c) => c.name),
    servicesWithPartners: services,
    commissionEnabled: Boolean(config?.commissionEnabled),
    onlinePaymentEnabled: Boolean(config?.mercadoPagoEnabled),
    autopilotAgentOnWhatsapp: agents > 0,
    backgroundCheckRequired: backgroundRule,
  }
}

export type PublicTrust = {
  claims: ClaimState
  /** Only what may be shown: null = hide it */
  stats: { verifiedPartners: number | null; completedServices: number | null; clients: number | null; rating: { value: number; reviews: number } | null; activeCities: string[] }
  commissionEnabled: boolean
}

async function loadPublicTrust(): Promise<PublicTrust> {
  const [claims, f] = await Promise.all([getClaimState(), getTrustFacts()])
  const on = claims.trust_real_stats
  return {
    claims,
    stats: {
      verifiedPartners: on ? showStat(f.verifiedPartners, STAT_MINIMUMS.verifiedPartners) : null,
      completedServices: on ? showStat(f.completedServices, STAT_MINIMUMS.completedServices) : null,
      clients: on ? showStat(f.clients, STAT_MINIMUMS.clients) : null,
      rating: on && f.avgRating && f.reviews >= STAT_MINIMUMS.reviewsForRating ? { value: f.avgRating, reviews: f.reviews } : null,
      activeCities: f.activeCities,
    },
    commissionEnabled: f.commissionEnabled,
  }
}

/** Cached 10 minutes; a claim change from the admin or Haggo revalidates the tag. */
export const getPublicTrust = unstable_cache(loadPublicTrust, ['public-trust-v1'], { revalidate: 600, tags: [TRUST_CACHE_TAG] })

const SAFE_FALLBACK: PublicTrust = {
  claims: defaultClaimState(),
  stats: { verifiedPartners: null, completedServices: null, clients: null, rating: null, activeCities: [] },
  commissionEnabled: false,
}

/** Never lets a public page fail: on a database error nothing is claimed. */
export async function getPublicTrustSafe(): Promise<PublicTrust> {
  try {
    return await getPublicTrust()
  } catch {
    return SAFE_FALLBACK
  }
}

/** Real testimonials: client reviews of 4★ or more with a comment, newest first. */
export async function realTestimonials(limit = 6) {
  const rows = await prisma.review.findMany({
    where: { clientToPartnerRating: { gte: 4 }, clientToPartnerComment: { not: null } },
    orderBy: { clientReviewedAt: 'desc' },
    take: limit * 2,
    select: { clientToPartnerRating: true, clientToPartnerComment: true, clientReviewedAt: true, booking: { select: { city: true, service: { select: { name: true } }, user: { select: { name: true } } } } },
  })
  return rows
    .filter((r) => (r.clientToPartnerComment ?? '').trim().length >= 15)
    .slice(0, limit)
    .map((r) => ({
      rating: r.clientToPartnerRating ?? 5,
      comment: (r.clientToPartnerComment ?? '').trim(),
      // First name and initial only: never the full name of a real client
      author: firstNameInitial(r.booking.user.name),
      service: r.booking.service.name,
      city: r.booking.city,
      at: r.clientReviewedAt,
    }))
}

export function firstNameInitial(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Cliente'
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
  return parts[1] ? `${first} ${parts[1].charAt(0).toUpperCase()}.` : first
}

/** For Haggo and the admin: everything, including what is on without backing. */
export async function trustReport() {
  const [claims, facts] = await Promise.all([getClaimState(), getTrustFacts()])
  return { claims, facts, unbacked: unbackedClaims(claims, facts), minimums: STAT_MINIMUMS }
}

/**
 * Launch benefits text for cities that are coming soon: the metadata of the `promo_launch_benefits` flag,
 * either a JSON `{ "benefits": ["…"] }` / `{ "text": "…" }` or plain lines. Empty when off or unset.
 */
export function parseLaunchBenefits(metadata: string | null | undefined): string[] {
  const raw = (metadata ?? '').trim()
  if (!raw) return []
  try {
    const j = JSON.parse(raw) as { benefits?: unknown; text?: unknown }
    if (Array.isArray(j.benefits)) return j.benefits.filter((b): b is string => typeof b === 'string' && b.trim().length > 0).map((b) => b.trim())
    if (typeof j.text === 'string') return j.text.split('\n').map((l) => l.trim()).filter(Boolean)
    return []
  } catch {
    return raw.split('\n').map((l) => l.trim()).filter(Boolean)
  }
}

/** Contact extras for public pages: the WhatsApp number of the floating button and the launch benefits. */
export async function publicContactExtras(claims: ClaimState): Promise<{ whatsappPhone: string | null; launchBenefits: string[] }> {
  try {
    const flags = await prisma.featureFlag.findMany({ where: { key: { in: ['whatsapp_float_button', 'promo_launch_benefits'] } }, select: { key: true, enabled: true, metadata: true } })
    const wa = flags.find((f) => f.key === 'whatsapp_float_button')
    let whatsappPhone: string | null = null
    if (wa?.enabled && wa.metadata) {
      try {
        const phone = (JSON.parse(wa.metadata) as { phone?: string }).phone
        whatsappPhone = phone ? phone.replace(/\D/g, '') || null : null
      } catch { /* ignore */ }
    }
    const promo = flags.find((f) => f.key === 'promo_launch_benefits')
    return { whatsappPhone, launchBenefits: claims.promo_launch_benefits ? parseLaunchBenefits(promo?.metadata) : [] }
  } catch {
    return { whatsappPhone: null, launchBenefits: [] }
  }
}
