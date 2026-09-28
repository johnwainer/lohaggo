/**
 * Measurable campaigns: the campaign code (`cmp-<last 8 of the id>`), UTM parameters on links to our site
 * and the WhatsApp short link `/w/cmp-…`. Requests whose first or last touch carries the code are credited
 * to the campaign. Pure.
 */
import type { MessagingChannel } from '@prisma/client'

export function campaignRefCode(campaignId: string) {
  return `cmp-${campaignId.slice(-8).toLowerCase()}`
}

export function utmSourceFor(channel: MessagingChannel | string) {
  const c = String(channel).toUpperCase()
  if (c === 'WHATSAPP') return 'whatsapp'
  if (c === 'EMAIL') return 'email'
  if (c === 'SMS') return 'sms'
  return c.toLowerCase()
}

function hostsOf(appUrl: string | null | undefined): Set<string> {
  const hosts = new Set(['lohaggo.com'])
  try {
    if (appUrl) hosts.add(new URL(appUrl).hostname.replace(/^www\./, '').toLowerCase())
  } catch {
    /* ignore */
  }
  return hosts
}

const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/gi

/**
 * Adds `utm_source/utm_medium=campaign/utm_campaign=cmp-…` to every link to our domain in the text (links that
 * already name a utm_campaign, and login links under /auth/, are left alone). Other domains are untouched.
 */
export function withCampaignUtm(text: string, opts: { channel: MessagingChannel | string; campaignId: string; appUrl?: string | null }): string {
  if (!text) return text
  const hosts = hostsOf(opts.appUrl)
  const source = utmSourceFor(opts.channel)
  const code = campaignRefCode(opts.campaignId)
  return text.replace(URL_RE, (match) => {
    const trail = /[.,;:!?]+$/.exec(match)?.[0] ?? ''
    const raw = trail ? match.slice(0, -trail.length) : match
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return match
    }
    if (!hosts.has(url.hostname.replace(/^www\./, '').toLowerCase())) return match
    if (url.pathname.startsWith('/auth/') || url.searchParams.has('utm_campaign')) return match
    url.searchParams.set('utm_source', source)
    url.searchParams.set('utm_medium', 'campaign')
    url.searchParams.set('utm_campaign', code)
    return url.toString() + trail
  })
}

/** Short link that opens our WhatsApp with `(ref: cmp-…)`, for the `{{campaign_link}}` variable. */
export function campaignWaLink(appUrl: string, campaignId: string) {
  return `${appUrl.replace(/\/+$/, '')}/w/${campaignRefCode(campaignId)}`
}

type TouchLike = { campaign?: unknown; ref?: unknown } | null | undefined

/** True when a stored touch (acquisition / lastTouch JSON) belongs to the campaign code. */
export function touchMatchesCampaign(touch: unknown, code: string): boolean {
  if (!touch || typeof touch !== 'object' || Array.isArray(touch)) return false
  const t = touch as TouchLike & object
  const c = typeof t.campaign === 'string' ? t.campaign.toLowerCase() : ''
  const r = typeof t.ref === 'string' ? t.ref.toLowerCase() : ''
  return c === code || r === code
}

/** Requests credited to a campaign (created since it started, first or last touch with its code) and the bookings made from them. Pure. */
export function campaignResults(
  code: string,
  since: Date | null,
  requests: Array<{ id: string; createdAt: Date; acquisition: unknown; lastTouch: unknown }>,
  bookings: Array<{ serviceRequestId: string | null }>,
) {
  const reqIds = new Set(
    requests
      .filter((r) => (!since || r.createdAt >= since) && (touchMatchesCampaign(r.acquisition, code) || touchMatchesCampaign(r.lastTouch, code)))
      .map((r) => r.id),
  )
  return { code, solicitudes: reqIds.size, reservas: bookings.filter((b) => b.serviceRequestId && reqIds.has(b.serviceRequestId)).length }
}
