import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Where a conversation came from, kept in `Conversation.customFields` (no schema change):
 * - `adReferral`: the first ad click that opened it (Click-to-WhatsApp via Twilio, or a Messenger/Instagram
 *   ad via Meta), never overwritten; `lastAdReferral` holds the latest one.
 * - `webRef`: the first `(ref: web-…)` / `(ref: blog-…)` tag the website puts in its prefilled message;
 *   `lastWebRef` / `lastWebRefAt` the latest one.
 * - `lastCampaign`: `{ code: 'cmp-…', at }` of the last messaging campaign sent on the conversation.
 */

export type AdReferral = {
  source: 'ctwa' | 'meta'
  adId: string | null
  ctwaClid?: string | null
  headline?: string | null
  url?: string | null
  type?: string | null
  ref?: string | null
  at: string
}

const clean = (v: unknown, max = 300) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : null
}

/** Click-to-WhatsApp parameters of a Twilio inbound webhook (Referral*), or null when the message is not from an ad. */
export function parseTwilioReferral(get: (key: string) => unknown, now: Date = new Date()): AdReferral | null {
  const adId = clean(get('ReferralSourceId'), 100)
  const ctwaClid = clean(get('ReferralCtwaClid'), 500)
  const url = clean(get('ReferralSourceUrl'))
  if (!adId && !ctwaClid && !url) return null
  return {
    source: 'ctwa',
    adId,
    ctwaClid,
    headline: clean(get('ReferralHeadline'), 200),
    url,
    type: clean(get('ReferralSourceType'), 40),
    at: now.toISOString(),
  }
}

/** A Meta (Messenger/Instagram) `referral` object; only ad referrals (with `ad_id` or source ADS) count as ads. */
export function parseMetaReferral(
  ref: { ref?: string; source?: string; type?: string; ad_id?: string } | null | undefined,
  now: Date = new Date(),
): { adReferral: AdReferral | null; ref: string | null } {
  if (!ref) return { adReferral: null, ref: null }
  const adId = clean(ref.ad_id, 100)
  const isAd = Boolean(adId) || (ref.source ?? '').toUpperCase() === 'ADS'
  const r = clean(ref.ref, 200)
  if (!isAd) return { adReferral: null, ref: r }
  return {
    adReferral: { source: 'meta', adId, ref: r, type: clean(ref.type, 40) ?? clean(ref.source, 40), at: now.toISOString() },
    ref: r,
  }
}

/**
 * `(ref: web-plomeria)` / `(ref: blog-como-...)` / `(ref: post-<id>)` (a marketing post) / `(ref: ad-<code>)`
 * (the prefilled message of an ad package) / `(ref: cmp-<code>)` (a messaging campaign) → the tag; null when none.
 */
export function extractWebRef(body: string | null | undefined): string | null {
  const m = /\(ref:\s*((?:web|blog|post|ad|cmp)-[a-z0-9][a-z0-9_-]{0,80})\s*\)/i.exec(body || '')
  return m ? m[1].toLowerCase() : null
}

type Fields = Record<string, unknown>

/**
 * New customFields with the attribution merged in (first ad and first webRef win; lastAdReferral and
 * lastWebRef/lastWebRefAt always take the newest), or null when nothing changes. Pure.
 */
export function mergeAttribution(current: unknown, input: { adReferral?: AdReferral | null; webRef?: string | null }, now: Date = new Date()): Fields | null {
  const fields: Fields = current && typeof current === 'object' && !Array.isArray(current) ? { ...(current as Fields) } : {}
  let changed = false
  if (input.adReferral) {
    if (!fields.adReferral) fields.adReferral = input.adReferral
    fields.lastAdReferral = input.adReferral
    changed = true
  }
  if (input.webRef) {
    const at = now.toISOString()
    if (!fields.webRef) {
      fields.webRef = input.webRef
      fields.webRefAt = at
    }
    fields.lastWebRef = input.webRef
    fields.lastWebRefAt = at
    changed = true
  }
  return changed ? fields : null
}

/** Saves the attribution on the conversation (and marks it as an ad conversation when it came from one). Never throws. */
export async function recordConversationAttribution(conversationId: string, input: { adReferral?: AdReferral | null; webRef?: string | null }) {
  if (!input.adReferral && !input.webRef) return false
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { customFields: true } })
    if (!conv) return false
    const next = mergeAttribution(conv.customFields, input)
    if (!next) return false
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { customFields: next as Prisma.InputJsonValue, ...(input.adReferral ? { isAd: true } : {}) },
    })
    return true
  } catch {
    return false
  }
}

type OriginConv = { id: string; channel: string; isAd: boolean; customFields: unknown }
type OriginRequest = { originConversationId: string | null; status: string }
type Bucket = { conversaciones: number; con_solicitud: number; solicitudes_aceptadas: number }

/**
 * Conversations of a period grouped by the ad (adReferral.adId) and the web page (webRef) that brought them,
 * with how many ended in a request (ServiceRequest.originConversationId) and in an accepted one. Pure.
 */
export function summarizeConversationOrigins(convs: OriginConv[], requests: OriginRequest[]) {
  const reqByConv = new Map<string, OriginRequest[]>()
  for (const r of requests) {
    if (!r.originConversationId) continue
    reqByConv.set(r.originConversationId, [...(reqByConv.get(r.originConversationId) ?? []), r])
  }
  const empty = (): Bucket => ({ conversaciones: 0, con_solicitud: 0, solicitudes_aceptadas: 0 })
  const add = (b: Bucket, id: string) => {
    const rs = reqByConv.get(id) ?? []
    b.conversaciones++
    if (rs.length > 0) b.con_solicitud++
    b.solicitudes_aceptadas += rs.filter((r) => r.status === 'ACCEPTED').length
  }
  const byAd = new Map<string, Bucket & { titulo: string | null; fuente: string }>()
  const byWeb = new Map<string, Bucket>()
  const byChannel = new Map<string, Bucket>()
  const total = empty()
  const unattributed = empty()
  const adUnknownId = empty()

  for (const c of convs) {
    const f = (c.customFields && typeof c.customFields === 'object' ? c.customFields : {}) as { adReferral?: Partial<AdReferral>; webRef?: string }
    add(total, c.id)
    const channel = byChannel.get(c.channel) ?? empty()
    add(channel, c.id)
    byChannel.set(c.channel, channel)
    const ad = f.adReferral
    if (ad?.adId) {
      const key = ad.adId
      const b = byAd.get(key) ?? { ...empty(), titulo: ad.headline ?? null, fuente: ad.source ?? 'ad' }
      add(b, c.id)
      byAd.set(key, b)
    } else if (ad || c.isAd) {
      add(adUnknownId, c.id)
    }
    if (f.webRef) {
      const b = byWeb.get(f.webRef) ?? empty()
      add(b, c.id)
      byWeb.set(f.webRef, b)
    }
    if (!ad && !c.isAd && !f.webRef) add(unattributed, c.id)
  }

  const sorted = <T extends Bucket>(m: Map<string, T>, key: string) =>
    Array.from(m.entries()).sort((a, b) => b[1].conversaciones - a[1].conversaciones).map(([k, v]) => ({ [key]: k, ...v }))

  return {
    total,
    por_anuncio: sorted(byAd, 'anuncio_id').slice(0, 25),
    anuncio_sin_id: adUnknownId,
    por_pagina_web: sorted(byWeb, 'ref').slice(0, 25),
    sin_origen: unattributed,
    por_canal: sorted(byChannel, 'canal'),
  }
}
