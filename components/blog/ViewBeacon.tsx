'use client'

import { useEffect } from 'react'

/** Counts one read of the article (once per page load, no cookies). */
export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const body = JSON.stringify({ slug })
    try {
      if (navigator.sendBeacon?.('/api/blog/view', new Blob([body], { type: 'application/json' }))) return
    } catch {
      // fall back to fetch
    }
    fetch('/api/blog/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => null)
  }, [slug])
  return null
}
