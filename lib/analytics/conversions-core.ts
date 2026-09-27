/**
 * Server conversions (Lead when a request is created, Purchase when a booking is completed or paid), built
 * for Meta's Conversions API and GA4's Measurement Protocol. Pure: no I/O, so the payloads are tested.
 * The event id is the same one the browser pixel uses, so Meta counts each conversion once.
 */
import { createHash } from 'crypto'
import type { Touch } from '@/lib/analytics/attribution-core'

export type ConversionKind = 'Lead' | 'Purchase'

export const conversionEventId = (kind: ConversionKind, entityId: string) => `${kind === 'Lead' ? 'lead' : 'purchase'}-${entityId}`

const sha = (v: string) => createHash('sha256').update(v).digest('hex')

export function hashEmail(email: string | null | undefined): string | null {
  const e = (email || '').trim().toLowerCase()
  if (!e || !e.includes('@') || e.endsWith('@clientes.lohaggo.com')) return null
  return sha(e)
}

/** Colombian mobiles typed as 3001234567 get the 57 prefix Meta expects (digits only, country code first). */
export function hashPhone(phone: string | null | undefined): string | null {
  let d = (phone || '').replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10 && d.startsWith('3')) d = `57${d}`
  if (d.length < 8) return null
  return sha(d)
}

export type ConversionInput = {
  kind: ConversionKind
  entityId: string
  at: Date
  value: number | null
  serviceId: string
  serviceName: string
  user: { id: string; email: string | null; phone: string | null }
  touch: Touch | null
  browser?: { ip: string | null; userAgent: string | null; url: string | null } | null
  siteUrl: string
}

/** Meta's event name for a Click-to-WhatsApp chat (business_messaging only takes its own names). */
const MESSAGING_NAMES: Record<ConversionKind, string> = { Lead: 'LeadSubmitted', Purchase: 'Purchase' }

/**
 * One Meta Conversions API event. A chat that came from a Click-to-WhatsApp ad goes as business_messaging
 * (with the ctwa_clid and the WhatsApp Business Account); another chat as `chat`; everything else as website.
 */
export function buildMetaEvent(i: ConversionInput, opts: { wabaId?: string | null } = {}) {
  const em = hashEmail(i.user.email)
  const ph = hashPhone(i.user.phone)
  const base = {
    event_time: Math.floor(i.at.getTime() / 1000),
    event_id: conversionEventId(i.kind, i.entityId),
    custom_data: {
      currency: 'COP',
      ...(i.value && i.value > 0 ? { value: Math.round(i.value) } : {}),
      content_name: i.serviceName,
      content_ids: [i.serviceId],
      content_type: 'product',
    },
  }
  const t = i.touch
  if (t?.via === 'chat' && t.ctwaClid && opts.wabaId && (t.channel ?? 'WHATSAPP') === 'WHATSAPP') {
    return {
      ...base,
      event_name: MESSAGING_NAMES[i.kind],
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: { whatsapp_business_account_id: opts.wabaId, ctwa_clid: t.ctwaClid, ...(ph ? { ph: [ph] } : {}), ...(em ? { em: [em] } : {}) },
    }
  }
  const userData: Record<string, unknown> = { external_id: [sha(i.user.id)] }
  if (em) userData.em = [em]
  if (ph) userData.ph = [ph]
  if (t?.via === 'chat') {
    return { ...base, event_name: i.kind, action_source: 'chat', user_data: userData }
  }
  if (t?.fbc) userData.fbc = t.fbc
  if (t?.fbp) userData.fbp = t.fbp
  if (i.browser?.ip) userData.client_ip_address = i.browser.ip
  if (i.browser?.userAgent) userData.client_user_agent = i.browser.userAgent
  return {
    ...base,
    event_name: i.kind,
    action_source: 'website',
    event_source_url: i.browser?.url || `${i.siteUrl}${i.kind === 'Lead' ? '/servicios' : '/dashboard'}`,
    user_data: userData,
  }
}

/** GA4 Measurement Protocol body: the browser's client id when we have it, else a stable one per user. */
export function buildGa4Event(i: ConversionInput) {
  const clientId = i.touch?.gaClientId || `${parseInt(sha(i.user.id).slice(0, 8), 16)}.${Math.floor(i.at.getTime() / 1000)}`
  const value = i.value && i.value > 0 ? Math.round(i.value) : undefined
  const items = [{ item_id: i.serviceId, item_name: i.serviceName }]
  const params = i.kind === 'Lead'
    ? { currency: 'COP', ...(value ? { value } : {}), items, lead_source: i.touch?.via ?? 'web' }
    : { currency: 'COP', value: value ?? 0, transaction_id: conversionEventId('Purchase', i.entityId), items }
  return {
    client_id: clientId,
    user_id: i.user.id,
    timestamp_micros: i.at.getTime() * 1000,
    events: [{ name: i.kind === 'Lead' ? 'generate_lead' : 'purchase', params }],
  }
}

/**
 * Where a conversion goes. GA4 has no dedupe with the browser, so a Lead the page already sent (web request)
 * is not repeated there; Purchase always goes (the browser never sees it).
 */
export function conversionDestinations(p: { kind: ConversionKind; browserSent: boolean; meta: boolean; ga4: boolean }): Array<'meta_capi' | 'ga4_mp'> {
  const out: Array<'meta_capi' | 'ga4_mp'> = []
  if (p.meta) out.push('meta_capi')
  if (p.ga4 && (p.kind === 'Purchase' || !p.browserSent)) out.push('ga4_mp')
  return out
}
