/**
 * The consolidated proposals message a client gets in the chat they asked from (pure). Instead of one
 * WhatsApp template per proposal, the open chat receives ONE comparable message («1) Darwin · $130.000 ·
 * 4.8★…; responde 1 o 2 para elegir»), updated at most every DIGEST_GAP_MS while new proposals keep coming.
 * The same text tells the client, after a partner cancels, which proposals of the request are still there.
 */
import { cop } from '@/lib/ai/actions-core'
import { PROPOSAL_BADGE_LABEL, rankProposals, type ProposalBadge, type RankableProposal } from '@/lib/proposals/ranking'
import { MAX_CHAT_OPTIONS, choosePrompt, type ProposalOption } from '@/lib/proposals/chat-compare'

export const DIGEST_KEY = 'proposalDigest'
/** A newer digest of the same request waits at least this long after the previous one */
export const DIGEST_GAP_MS = 30 * 60_000
/** Free text only well inside the 24 h window */
export const DIGEST_WINDOW_MARGIN_MS = 10 * 60_000
export const DIGEST_CHANNELS = new Set(['WHATSAPP', 'MESSENGER', 'INSTAGRAM'])

export type DigestEntry = { at: string; ids: string[] }
export type DigestState = Record<string, DigestEntry>

export function readDigestState(customFields: unknown): DigestState {
  const fields = customFields && typeof customFields === 'object' ? (customFields as Record<string, unknown>) : {}
  const raw = fields[DIGEST_KEY]
  if (!raw || typeof raw !== 'object') return {}
  const out: DigestState = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = v as Partial<DigestEntry>
    if (e && typeof e.at === 'string' && Array.isArray(e.ids)) out[k] = { at: e.at, ids: e.ids.filter((x): x is string => typeof x === 'string') }
  }
  return out
}

/** «send» now, «wait» (a digest went out a moment ago: the next run sends the update) or «nothing» new. */
export function digestDecision(last: DigestEntry | null | undefined, pendingIds: string[], now: Date): 'send' | 'wait' | 'nothing' {
  if (!pendingIds.length) return 'nothing'
  if (last && pendingIds.every((id) => last.ids.includes(id))) return 'nothing'
  if (last && now.getTime() - new Date(last.at).getTime() < DIGEST_GAP_MS) return 'wait'
  return 'send'
}

/** The 24 h window of the client's chat is open with a margin (free text allowed). */
export function chatWindowOpen(channel: string, lastInboundAt: Date | string | null | undefined, now: Date) {
  if (!DIGEST_CHANNELS.has(channel) || !lastInboundAt) return false
  const at = new Date(lastInboundAt).getTime()
  return Number.isFinite(at) && now.getTime() - at < 24 * 3600_000 - DIGEST_WINDOW_MARGIN_MS
}

export type DigestProposal = RankableProposal & {
  partnerName: string
  /** «sáb 15 nov 09:00» or null (the request's date) */
  when: string | null
}

/** «1) Darwin · $130.000 · 4.8★ (12 reseñas) · propone sáb 15 nov 09:00 · Mejor calificado» */
export function digestLine(n: number, p: DigestProposal, badges: ProposalBadge[]) {
  const reviews = p.partner.totalReviews ?? 0
  const rep = reviews > 0 ? `${(p.partner.rating ?? 0).toFixed(1)}★ (${reviews} reseña${reviews === 1 ? '' : 's'})` : 'nuevo, sin reseñas'
  return [`${n}) ${p.partnerName}`, cop(p.price), rep, p.when ? `propone ${p.when}` : null, ...badges.map((b) => PROPOSAL_BADGE_LABEL[b])].filter(Boolean).join(' · ')
}

export type DigestKind = 'new' | 'partner_cancelled'

/**
 * The message and the numbering it shows (kept on the conversation so «2» means that proposal).
 * Best value first (lib/proposals/ranking.ts), at most MAX_CHAT_OPTIONS.
 */
export function buildDigest(p: { kind: DigestKind; service: string; requestId: string; partnerName?: string | null; proposals: DigestProposal[]; clientFeePct?: number }) {
  const ranked = rankProposals(p.proposals).filter((r) => !r.proposal.status || r.proposal.status === 'PENDING').slice(0, MAX_CHAT_OPTIONS)
  const options: ProposalOption[] = ranked.map((r, i) => ({ n: i + 1, id: r.proposal.id, requestId: p.requestId, label: `${r.proposal.partnerName} · ${cop(r.proposal.price)}` }))
  const lines = ranked.map((r, i) => digestLine(i + 1, r.proposal, r.badges))
  const fee = p.clientFeePct && p.clientFeePct > 0 ? ` Al precio del servicio se suma la tarifa de servicio de ${p.clientFeePct} %.` : ''
  const who = p.partnerName?.trim().split(/\s+/)[0] || 'El socio'
  let text: string
  if (p.kind === 'partner_cancelled') {
    text = lines.length
      ? `${who} canceló tu reserva de ${p.service}, pero tu solicitud sigue abierta y estas propuestas siguen disponibles:\n${lines.join('\n')}\n${choosePrompt(lines.length)} y queda reservado; también puedes esperar nuevas propuestas.${fee}`
      : `${who} canceló tu reserva de ${p.service}. Tu solicitud volvió a abrirse y ya se la enviamos a otros socios: te aviso aquí apenas llegue una propuesta.`
  } else {
    const head = lines.length === 1 ? `Ya tienes una propuesta para ${p.service}:` : `Ya tienes ${lines.length} propuestas para ${p.service}, de mejor a peor relación calidad-precio:`
    text = `${head}\n${lines.join('\n')}\n${choosePrompt(lines.length)}, o pregúntame lo que quieras de ellas.${fee}`
  }
  return { text, options }
}
