'use client'

import { useEffect } from 'react'

const FIRST = 'lh_acq'
const LAST = 'lh_lt'
const FIRST_DAYS = 90
const LAST_DAYS = 30

function write(name: string, data: unknown, days: number) {
  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(data))}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

/**
 * Where the person came from, in first-party cookies (no personal data):
 * - first touch (lh_acq): the first visit, kept 90 days; signup and every request store it.
 * - last touch (lh_lt): replaced on each visit that brings campaign data (UTM, an ad click id, another
 *   site); requests and bookings are credited to it on the attribution board.
 */
export default function AcquisitionTracker() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return
      const p = url.searchParams
      // lohaggo.com → www.lohaggo.com (or http → https) is still our own site, not a referral
      const bare = (h: string) => h.toLowerCase().replace(/^www\./, '')
      const refHost = (() => {
        try {
          return document.referrer ? bare(new URL(document.referrer).hostname) : null
        } catch {
          return null
        }
      })()
      const ref = refHost && refHost !== bare(window.location.hostname) ? document.referrer : null
      const data = {
        source: p.get('utm_source'), medium: p.get('utm_medium'), campaign: p.get('utm_campaign'), content: p.get('utm_content'), term: p.get('utm_term'),
        fbclid: p.get('fbclid')?.slice(0, 500) ?? null, gclid: p.get('gclid')?.slice(0, 300) ?? null,
        referrer: ref ? ref.slice(0, 300) : null,
        landing: `${url.pathname}`.slice(0, 300),
        at: new Date().toISOString(),
      }
      const cookies = document.cookie.split('; ')
      if (!cookies.some((c) => c.startsWith(`${FIRST}=`))) write(FIRST, data, FIRST_DAYS)
      const campaignVisit = Boolean(data.source || data.fbclid || data.gclid || data.referrer)
      if (campaignVisit || !cookies.some((c) => c.startsWith(`${LAST}=`))) write(LAST, data, LAST_DAYS)
    } catch {
      // Cookies blocked: nothing to remember
    }
  }, [])
  return null
}
