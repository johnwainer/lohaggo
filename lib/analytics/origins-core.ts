/**
 * «De dónde vienen las solicitudes»: conversations, requests, bookings, completed services and sales grouped
 * by channel, campaign and piece, with the typed ad spend divided in. Pure, so the board and Haggo agree.
 */
import {
  CHANNEL_LABELS, classifyTouch, readTouch, touchesFromConversation,
  type ChannelKey, type TouchBucket,
} from '@/lib/analytics/attribution-core'

export type AttributionModel = 'last' | 'first'

export type OriginConversation = { id: string; channel: string; customFields: unknown }
export type OriginRequest = { id: string; acquisition: unknown; lastTouch: unknown }
export type OriginBooking = { id: string; status: string; totalPrice: number; requestId: string | null; acquisition: unknown; lastTouch: unknown }

export type FunnelRow = {
  key: string
  channel: ChannelKey
  channelLabel: string
  campaign: string | null
  content: string | null
  label: string
  conversations: number
  requests: number
  bookings: number
  completed: number
  sales: number
  spend: number
  costPerRequest: number | null
  costPerBooking: number | null
}

export type OriginLabels = {
  /** ad-<code> → package title */
  adDrafts: Map<string, { id: string; title: string }>
  /** post id → title */
  posts: Map<string, string>
}

const empty = (key: string, b: TouchBucket): Omit<FunnelRow, 'label'> => ({
  key, channel: b.channel, channelLabel: CHANNEL_LABELS[b.channel], campaign: b.campaign, content: b.content,
  conversations: 0, requests: 0, bookings: 0, completed: 0, sales: 0, spend: 0, costPerRequest: null, costPerBooking: null,
})

function labelFor(b: TouchBucket, labels: OriginLabels, level: 'campaign' | 'piece') {
  const parts: string[] = []
  const draft = b.campaign ? labels.adDrafts.get(b.campaign) : undefined
  parts.push(draft ? `Pauta «${draft.title}»` : b.campaign ?? CHANNEL_LABELS[b.channel])
  if (level === 'piece' && b.content) {
    const post = labels.posts.get(b.content)
    parts.push(post ? `«${post}»` : b.channel === 'meta_ads' ? `anuncio ${b.content}` : b.content)
  }
  return parts.join(' · ')
}

const finish = (r: Omit<FunnelRow, 'label'>, label: string): FunnelRow => ({
  ...r, label,
  costPerRequest: r.spend > 0 && r.requests > 0 ? Math.round(r.spend / r.requests) : null,
  costPerBooking: r.spend > 0 && r.bookings > 0 ? Math.round(r.spend / r.bookings) : null,
})

const rank = (a: FunnelRow, b: FunnelRow) => b.requests - a.requests || b.bookings - a.bookings || b.conversations - a.conversations || b.spend - a.spend

export function summarizeOrigins(p: {
  conversations: OriginConversation[]
  requests: OriginRequest[]
  bookings: OriginBooking[]
  /** adDraftId → COP in the period */
  spendByDraft: Map<string, number>
  labels: OriginLabels
  model: AttributionModel
}) {
  const pick = (first: unknown, last: unknown) => classifyTouch(readTouch(p.model === 'first' ? first : last) ?? readTouch(first) ?? readTouch(last))
  const byChannel = new Map<string, Omit<FunnelRow, 'label'>>()
  const byCampaign = new Map<string, Omit<FunnelRow, 'label'> & { bucket: TouchBucket }>()
  const byPiece = new Map<string, Omit<FunnelRow, 'label'> & { bucket: TouchBucket }>()

  const bump = (b: TouchBucket, apply: (r: Omit<FunnelRow, 'label'>) => void) => {
    const ch = byChannel.get(b.channel) ?? empty(b.channel, { channel: b.channel, campaign: null, content: null })
    apply(ch)
    byChannel.set(b.channel, ch)
    if (b.campaign) {
      const k = `${b.channel}|${b.campaign}`
      const c = byCampaign.get(k) ?? { ...empty(k, { ...b, content: null }), bucket: { ...b, content: null } }
      apply(c)
      byCampaign.set(k, c)
    }
    if (b.content && (b.channel === 'meta_ads' || b.channel === 'publicaciones' || b.channel === 'blog')) {
      const k = `${b.channel}|${b.campaign ?? ''}|${b.content}`
      const c = byPiece.get(k) ?? { ...empty(k, b), bucket: b }
      apply(c)
      byPiece.set(k, c)
    }
  }

  for (const c of p.conversations) {
    const t = touchesFromConversation(c.customFields, c.channel)
    bump(classifyTouch(p.model === 'first' ? t.first : t.last), (r) => { r.conversations++ })
  }
  const requestBucket = new Map<string, TouchBucket>()
  for (const r of p.requests) {
    const b = pick(r.acquisition, r.lastTouch)
    requestBucket.set(r.id, b)
    bump(b, (row) => { row.requests++ })
  }
  for (const bk of p.bookings) {
    const b = (bk.requestId ? requestBucket.get(bk.requestId) : undefined) ?? pick(bk.acquisition, bk.lastTouch)
    bump(b, (row) => {
      row.bookings++
      if (bk.status === 'COMPLETED') { row.completed++; row.sales += bk.totalPrice }
    })
  }

  // Spend: each package's spend goes to its campaign row (ad-<code>) and to the Meta ads channel
  let spendTotal = 0
  for (const [draftId, cop] of Array.from(p.spendByDraft.entries())) {
    spendTotal += cop
    const code = `ad-${draftId.slice(-8).toLowerCase()}`
    const b: TouchBucket = { channel: 'meta_ads', campaign: code, content: null }
    const k = `meta_ads|${code}`
    const row = byCampaign.get(k) ?? { ...empty(k, b), bucket: b }
    row.spend += cop
    byCampaign.set(k, row)
    const ch = byChannel.get('meta_ads') ?? empty('meta_ads', { channel: 'meta_ads', campaign: null, content: null })
    ch.spend += cop
    byChannel.set('meta_ads', ch)
  }

  const channels = Array.from(byChannel.values()).map((r) => finish(r, CHANNEL_LABELS[r.channel])).sort(rank)
  const campaigns = Array.from(byCampaign.values()).map((r) => finish(r, labelFor(r.bucket, p.labels, 'campaign'))).sort(rank).slice(0, 30)
  const pieces = Array.from(byPiece.values()).map((r) => finish(r, labelFor(r.bucket, p.labels, 'piece'))).sort(rank).slice(0, 30)
  const totals = channels.reduce((a, r) => ({
    conversations: a.conversations + r.conversations, requests: a.requests + r.requests, bookings: a.bookings + r.bookings,
    completed: a.completed + r.completed, sales: a.sales + r.sales,
  }), { conversations: 0, requests: 0, bookings: 0, completed: 0, sales: 0 })
  const paid = channels.find((r) => r.channel === 'meta_ads')
  return {
    model: p.model,
    totals: { ...totals, spend: spendTotal, costPerRequest: spendTotal > 0 && paid?.requests ? Math.round(spendTotal / paid.requests) : null },
    channels,
    campaigns,
    pieces,
  }
}

/**
 * Packages with spend on `minDays` of the last days and no request credited to them: the «gasto sin
 * solicitudes» rule. `requestsByCampaign` counts requests per ad-<code> (any model).
 */
export function spendWithoutRequests(p: {
  spendDays: Array<{ key: string; day: Date; amountCop: number }>
  requestsByCampaign: Map<string, number>
  minDays: number
}) {
  const days = new Map<string, { days: Set<string>; cop: number }>()
  for (const s of p.spendDays) {
    const d = days.get(s.key) ?? { days: new Set<string>(), cop: 0 }
    d.days.add(s.day.toISOString().slice(0, 10))
    d.cop += s.amountCop
    days.set(s.key, d)
  }
  return Array.from(days.entries())
    .filter(([key, d]) => d.days.size >= p.minDays && (p.requestsByCampaign.get(`ad-${key.slice(-8).toLowerCase()}`) ?? 0) === 0)
    .map(([key, d]) => ({ adDraftId: key, daysWithSpend: d.days.size, spendCop: d.cop }))
}
