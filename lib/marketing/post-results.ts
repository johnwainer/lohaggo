/**
 * Requests and bookings each marketing post brought: a request is credited to a post when its first or last
 * touch names it (utm_content = post id on the web, or `(ref: post-<id>)` in a WhatsApp chat). This is what
 * the marketing agent learns from (KPI «solicitudes» / «reservas»), not reach.
 */
import type { MarketingChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readTouch, type Touch } from '@/lib/analytics/attribution-core'

export type PostResult = { requests: number; bookings: number; completed: number; byChannel: Partial<Record<MarketingChannel, { requests: number; bookings: number }>> }

/** The channel a touch came through: the utm_source of the web link, or Facebook for a post's WhatsApp link. */
function channelOf(t: Touch | null): MarketingChannel | null {
  const s = (t?.source ?? '').toLowerCase()
  // A chat from a post's /w/post-… link: that link lives in the post's Facebook text
  if (s === 'publicacion') return 'FACEBOOK'
  if (s.includes('instagram')) return 'INSTAGRAM'
  if (s.includes('facebook')) return 'FACEBOOK'
  if (s.includes('blog')) return 'WEB'
  return null
}

type Req = { id: string; acquisition: unknown; lastTouch: unknown }
type Bk = { requestId: string | null; status: string }

/** Pure: requests and their bookings credited to the posts they name. */
export function creditPosts(postIds: Set<string>, requests: Req[], bookings: Bk[]): Map<string, PostResult> {
  const out = new Map<string, PostResult>()
  const credit = new Map<string, { postId: string; channel: MarketingChannel | null }>()
  for (const r of requests) {
    const last = readTouch(r.lastTouch)
    const first = readTouch(r.acquisition)
    const hit = [last, first].find((t) => t?.content && postIds.has(t.content))
    if (!hit?.content) continue
    credit.set(r.id, { postId: hit.content, channel: channelOf(hit) })
    const row = out.get(hit.content) ?? { requests: 0, bookings: 0, completed: 0, byChannel: {} }
    row.requests++
    const ch = channelOf(hit)
    if (ch) (row.byChannel[ch] ??= { requests: 0, bookings: 0 }).requests++
    out.set(hit.content, row)
  }
  for (const b of bookings) {
    const c = b.requestId ? credit.get(b.requestId) : undefined
    if (!c) continue
    const row = out.get(c.postId)!
    row.bookings++
    if (b.status === 'COMPLETED') row.completed++
    if (c.channel) (row.byChannel[c.channel] ??= { requests: 0, bookings: 0 }).bookings++
  }
  return out
}

export async function postResults(postIds: string[], since: Date): Promise<Map<string, PostResult>> {
  if (!postIds.length) return new Map()
  const requests = await prisma.serviceRequest.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, acquisition: true, lastTouch: true },
    take: 5000,
  }).catch(() => [])
  const withTouch = requests.filter((r) => r.acquisition || r.lastTouch)
  const bookings = withTouch.length
    ? await prisma.booking.findMany({ where: { proposal: { serviceRequestId: { in: withTouch.map((r) => r.id) } } }, select: { status: true, proposal: { select: { serviceRequestId: true } } } }).catch(() => [])
    : []
  return creditPosts(new Set(postIds), withTouch, bookings.map((b) => ({ status: b.status, requestId: b.proposal?.serviceRequestId ?? null })))
}

/** Pure: chats per post from the conversations' first and last web ref (`post-<id>`), each chat counted once. */
export function chatsByPost(postIds: Set<string>, conversations: Array<{ customFields: unknown }>): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of conversations) {
    const f = (c.customFields && typeof c.customFields === 'object' ? c.customFields : {}) as { webRef?: unknown; lastWebRef?: unknown }
    const ids = new Set([f.webRef, f.lastWebRef].filter((r): r is string => typeof r === 'string' && r.startsWith('post-')).map((r) => r.slice(5)))
    for (const id of Array.from(ids)) if (postIds.has(id)) out.set(id, (out.get(id) ?? 0) + 1)
  }
  return out
}

/** Chats (WhatsApp, Messenger, Instagram) opened from a post's link or prefilled message `(ref: post-<id>)` since `since`. */
export async function postChats(postIds: string[], since: Date): Promise<Map<string, number>> {
  if (!postIds.length) return new Map()
  const conversations = await prisma.conversation.findMany({
    where: { createdAt: { gte: since }, OR: [{ customFields: { path: ['webRef'], string_starts_with: 'post-' } }, { customFields: { path: ['lastWebRef'], string_starts_with: 'post-' } }] },
    select: { customFields: true },
    take: 5000,
  }).catch(() => [])
  return chatsByPost(new Set(postIds), conversations)
}
