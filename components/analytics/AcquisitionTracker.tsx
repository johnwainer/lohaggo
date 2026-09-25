'use client'

import { useEffect } from 'react'

const COOKIE = 'lh_acq'
const DAYS = 90

/**
 * First touch: on the first visit, remembers where the person came from (UTM, the site that sent
 * them, the page they landed on) in a first-party cookie. Signup stores it on the account, so
 * Analítica can tell which campaigns and channels bring clients and partners. No personal data.
 */
export default function AcquisitionTracker() {
  useEffect(() => {
    try {
      if (document.cookie.split('; ').some((c) => c.startsWith(`${COOKIE}=`))) return
      const url = new URL(window.location.href)
      if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return
      const p = url.searchParams
      const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : null
      const data = {
        source: p.get('utm_source'), medium: p.get('utm_medium'), campaign: p.get('utm_campaign'), content: p.get('utm_content'), term: p.get('utm_term'),
        referrer: ref ? ref.slice(0, 300) : null,
        landing: `${url.pathname}`.slice(0, 300),
        at: new Date().toISOString(),
      }
      document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(data))}; Max-Age=${DAYS * 86400}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    } catch {
      // Cookies blocked: nothing to remember
    }
  }, [])
  return null
}
