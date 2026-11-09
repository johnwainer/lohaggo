/**
 * Comparing the proposals of one request (pure: the client panel and the chat agent use the same order
 * and the same badges). Best value = good rating (with enough reviews to trust it) for a fair price, with
 * a little weight for experience. Proposals that can still be chosen go first.
 */

export type RankableProposal = {
  id: string
  price: number
  status?: string | null
  createdAt?: Date | string | null
  partner: { rating?: number | null; totalReviews?: number | null; completedServicesCount?: number | null }
}

export type ProposalBadge = 'best_rated' | 'cheapest'

export const PROPOSAL_BADGE_LABEL: Record<ProposalBadge, string> = {
  best_rated: 'Mejor calificado',
  cheapest: 'Más económico',
}

/** Average a newcomer is assumed to have, and how many reviews it takes to trust a partner's own average. */
const PRIOR_RATING = 4
const PRIOR_WEIGHT = 3

/** Rating pulled toward 4★ while there are few reviews: one 5★ review does not beat forty 4.8★ ones. */
export function trustedRating(p: RankableProposal['partner']) {
  const n = Math.max(0, p.totalReviews ?? 0)
  const r = n > 0 ? Math.min(5, Math.max(0, p.rating ?? 0)) : 0
  return (r * n + PRIOR_RATING * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT)
}

/** 0–1: 50 % trusted rating, 40 % price (cheapest = 1), 10 % jobs done (20 or more = 1). */
export function valueScore(p: RankableProposal, minPrice: number) {
  const rating = trustedRating(p.partner) / 5
  const price = p.price > 0 && minPrice > 0 ? Math.min(1, minPrice / p.price) : 0
  const jobs = Math.min(20, Math.max(0, p.partner.completedServicesCount ?? 0)) / 20
  return 0.5 * rating + 0.4 * price + 0.1 * jobs
}

const open = (p: RankableProposal) => !p.status || p.status === 'PENDING'

export type RankedProposal<T extends RankableProposal> = { proposal: T; score: number; badges: ProposalBadge[] }

/**
 * Best value first among the open ones (accepted / rejected after them, newest first). Badges only when
 * there is something to compare (two or more open proposals) and only for a clear winner.
 */
export function rankProposals<T extends RankableProposal>(list: T[]): Array<RankedProposal<T>> {
  const choosable = list.filter(open)
  const minPrice = choosable.length ? Math.min(...choosable.map((p) => p.price).filter((x) => x > 0)) : 0
  const badges = new Map<string, ProposalBadge[]>()
  if (choosable.length >= 2) {
    const reviewed = choosable.filter((p) => (p.partner.totalReviews ?? 0) > 0)
    if (reviewed.length) {
      const best = Math.max(...reviewed.map((p) => p.partner.rating ?? 0))
      const top = reviewed.filter((p) => (p.partner.rating ?? 0) === best)
      if (top.length === 1) badges.set(top[0].id, ['best_rated'])
    }
    const cheapest = choosable.filter((p) => p.price === minPrice)
    if (cheapest.length === 1 && choosable.some((p) => p.price > minPrice)) badges.set(cheapest[0].id, [...(badges.get(cheapest[0].id) ?? []), 'cheapest'])
  }
  const time = (p: RankableProposal) => (p.createdAt ? new Date(p.createdAt).getTime() : 0)
  return list
    .map((proposal) => ({ proposal, score: open(proposal) ? valueScore(proposal, Number.isFinite(minPrice) ? minPrice : 0) : -1, badges: badges.get(proposal.id) ?? [] }))
    .sort((a, b) => (b.score - a.score) || (time(b.proposal) - time(a.proposal)))
}
