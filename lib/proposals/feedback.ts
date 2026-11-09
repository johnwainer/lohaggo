/**
 * Why a client turned down (or left without answer) the proposals of a request. Stored as an
 * AdminAuditLog row on the request (action PROPOSAL_FEEDBACK) so the team sees it in the request page.
 * Pure: shared by the client panel chips, the chat agent and the admin view.
 */

export const PROPOSAL_FEEDBACK_ACTION = 'PROPOSAL_FEEDBACK'

export const PROPOSAL_REASONS = ['precio_alto', 'fecha_no_sirve', 'poca_experiencia', 'ya_lo_resolvi', 'quiero_mas_opciones', 'otro', 'sin_motivo'] as const
export type ProposalReason = (typeof PROPOSAL_REASONS)[number]

export const PROPOSAL_REASON_LABEL: Record<ProposalReason, string> = {
  precio_alto: 'Precio alto',
  fecha_no_sirve: 'La fecha u hora no me sirve',
  poca_experiencia: 'Poca experiencia o reseñas',
  ya_lo_resolvi: 'Ya lo resolví',
  quiero_mas_opciones: 'Quiero ver más opciones',
  otro: 'Otro motivo',
  sin_motivo: 'Prefirió no decir',
}

/** The chips the client panel offers (no «prefirió no decir»: not choosing a chip is that). */
export const PANEL_REASONS: ProposalReason[] = ['precio_alto', 'fecha_no_sirve', 'poca_experiencia', 'ya_lo_resolvi', 'quiero_mas_opciones', 'otro']

export const isProposalReason = (v: unknown): v is ProposalReason => typeof v === 'string' && (PROPOSAL_REASONS as readonly string[]).includes(v)

export type ProposalFeedback = {
  reason: ProposalReason
  detail: string | null
  /** rejected: the client turned the proposal(s) down; ignored: they stay open, the client said why none fits */
  kind: 'rejected' | 'ignored'
  proposalIds: string[]
  source: 'app' | 'chat'
}

export function feedbackDetails(f: ProposalFeedback) {
  return JSON.stringify({ ...f, detail: f.detail?.trim().slice(0, 300) || null })
}

export function parseFeedback(details: string | null | undefined): ProposalFeedback | null {
  if (!details) return null
  try {
    const o = JSON.parse(details) as Partial<ProposalFeedback>
    if (!isProposalReason(o.reason)) return null
    return {
      reason: o.reason,
      detail: typeof o.detail === 'string' ? o.detail : null,
      kind: o.kind === 'ignored' ? 'ignored' : 'rejected',
      proposalIds: Array.isArray(o.proposalIds) ? o.proposalIds.filter((x): x is string => typeof x === 'string') : [],
      source: o.source === 'chat' ? 'chat' : 'app',
    }
  } catch {
    return null
  }
}

/** «Precio alto: me cobraban el doble» */
export function feedbackLine(f: Pick<ProposalFeedback, 'reason' | 'detail'>) {
  return `${PROPOSAL_REASON_LABEL[f.reason]}${f.detail?.trim() ? `: ${f.detail.trim()}` : ''}`
}
