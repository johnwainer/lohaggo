/**
 * Client-side marketing events for the Meta Pixel (window.fbq) and GA4 (window.gtag).
 * Safe on the server and when neither script is loaded: it just does nothing. Never throws.
 */

export type TrackParams = {
  content_name?: string
  content_ids?: string[]
  content_category?: string
  value?: number
  currency?: string
  [key: string]: unknown
}

type Fn = (...args: unknown[]) => void

/** Our event name → Meta standard event + GA4 event. */
export const TRACK_EVENTS = {
  view_content: { meta: 'ViewContent', ga4: 'view_item' },
  begin_checkout: { meta: 'InitiateCheckout', ga4: 'begin_checkout' },
  lead: { meta: 'Lead', ga4: 'generate_lead' },
  whatsapp_click: { meta: 'Contact', ga4: 'whatsapp_click' },
  search: { meta: 'Search', ga4: 'search' },
} as const

export type TrackEventName = keyof typeof TRACK_EVENTS

function ga4Params(p: TrackParams): Record<string, unknown> {
  const { content_name, content_ids, content_category, ...rest } = p
  const out: Record<string, unknown> = { ...rest }
  if (content_name) out.content_name = content_name
  if (content_name || content_ids?.length) {
    out.items = [{ item_id: content_ids?.[0], item_name: content_name, item_category: content_category }]
  }
  if (out.value !== undefined && !out.currency) out.currency = 'COP'
  return out
}

export function track(event: TrackEventName, params: TrackParams = {}) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { fbq?: Fn; gtag?: Fn }
  const names = TRACK_EVENTS[event]
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  try {
    if (typeof w.fbq === 'function') {
      const meta = { ...clean } as TrackParams
      if (meta.value !== undefined && !meta.currency) meta.currency = 'COP'
      w.fbq('track', names.meta, meta)
    }
  } catch { /* analytics must never break the page */ }
  try {
    if (typeof w.gtag === 'function') w.gtag('event', names.ga4, ga4Params(clean as TrackParams))
  } catch { /* idem */ }
}
