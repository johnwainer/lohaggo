/**
 * Side-by-side comparison of the proposals the client can still choose (pure; the compare sheet and the
 * proposal cards use it). Order and badges come from rankProposals so the sheet and the list agree.
 */
import { rankProposals, type ProposalBadge, type RankableProposal } from '@/lib/proposals/ranking'

export type CompareDocument = { type: string; status: string }

export type ComparableProposal = RankableProposal & {
  proposedDate?: string | null
  proposedTime?: string | null
  notes?: string | null
  partner: RankableProposal['partner'] & {
    isCompany?: boolean | null
    companyName?: string | null
    user: { name: string }
    documents?: CompareDocument[]
  }
}

const IDENTITY = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
const EDUCATION = ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO']

/** A company partner shows its company name; a person, their name. */
export function partnerLabel(partner: { isCompany?: boolean | null; companyName?: string | null; user: { name: string } }): string {
  return partner.isCompany && partner.companyName?.trim() ? partner.companyName.trim() : partner.user.name
}

/** The checks the partner passed (approved documents only), in the order clients care about. */
export function verificationLabels(documents: CompareDocument[] | undefined): string[] {
  const ok = (documents ?? []).filter((d) => d.status === 'APPROVED')
  const out: string[] = []
  if (ok.some((d) => IDENTITY.includes(d.type))) out.push('Identidad')
  if (ok.some((d) => d.type === 'ANTECEDENTES')) out.push('Antecedentes')
  if (ok.some((d) => EDUCATION.includes(d.type))) out.push('Estudios')
  return out
}

export const clientFeeOf = (price: number, ratePct: number) => (ratePct > 0 ? Math.round((price * ratePct) / 100) : 0)

export type ComparisonRow<T extends ComparableProposal> = {
  proposal: T
  name: string
  badges: ProposalBadge[]
  fee: number
  total: number
  /** Pesos above the cheapest open proposal (0 for the cheapest) */
  vsCheapest: number
  verification: string[]
  /** 1 = best value */
  position: number
}

/** Open proposals only, best value first, each with what the client needs to decide. */
export function buildComparison<T extends ComparableProposal>(proposals: T[], clientRatePct: number): Array<ComparisonRow<T>> {
  const open = proposals.filter((p) => !p.status || p.status === 'PENDING')
  const ranked = rankProposals(open)
  const min = open.length ? Math.min(...open.map((p) => p.price)) : 0
  return ranked.map(({ proposal, badges }, i) => {
    const fee = clientFeeOf(proposal.price, clientRatePct)
    return {
      proposal,
      name: partnerLabel(proposal.partner),
      badges,
      fee,
      total: proposal.price + fee,
      vsCheapest: Math.max(0, proposal.price - min),
      verification: verificationLabels(proposal.partner.documents),
      position: i + 1,
    }
  })
}

export type ReviewPreview = { rating: number; comment: string | null; reviewer: string; service: string | null; at: string | null }

/** First name only and no more than 2 reviews, newest first: what the compare sheet and cards show. */
export function reviewPreview(rows: Array<{ clientToPartnerRating: number | null; clientToPartnerComment: string | null; clientReviewedAt: Date | null; reviewerName: string | null; serviceName: string | null }>, limit = 2): ReviewPreview[] {
  return rows
    .filter((r) => typeof r.clientToPartnerRating === 'number')
    .sort((a, b) => (b.clientReviewedAt?.getTime() ?? 0) - (a.clientReviewedAt?.getTime() ?? 0))
    .slice(0, limit)
    .map((r) => ({
      rating: r.clientToPartnerRating as number,
      comment: r.clientToPartnerComment?.trim() ? r.clientToPartnerComment.trim().slice(0, 240) : null,
      reviewer: (r.reviewerName ?? '').trim().split(/\s+/)[0] || 'Cliente',
      service: r.serviceName,
      at: r.clientReviewedAt ? r.clientReviewedAt.toISOString() : null,
    }))
}
