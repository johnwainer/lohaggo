'use client'

import { useEffect, useState } from 'react'

let cache: string | null = null
let inflight: Promise<string | null> | null = null

function load(): Promise<string | null> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/public/response-time')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { label?: string } | null) => (cache = d?.label ?? null))
      .catch(() => null)
      .finally(() => { inflight = null })
  }
  return inflight
}

/** «~7 min»: the typical wait for the first proposal; null until it loads (the screen then says «pronto»). */
export function useResponseTime(): string | null {
  const [label, setLabel] = useState<string | null>(cache)
  useEffect(() => {
    let alive = true
    load().then((l) => { if (alive) setLabel(l) })
    return () => { alive = false }
  }, [])
  return label
}

const KEY = (id: string) => `lohaggo:notified:${id}`

/** The partners told about a request, kept for the dashboard's waiting screen (real number from the create response). */
export function rememberNotified(requestId: string, count: number) {
  try { sessionStorage.setItem(KEY(requestId), String(count)) } catch { /* private mode */ }
}

export function recallNotified(requestId: string): number | null {
  try {
    const v = sessionStorage.getItem(KEY(requestId))
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}
