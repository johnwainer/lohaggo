'use client'

import { useEffect } from 'react'

// Noise injected by the Facebook / Instagram in-app browser bridge. These come
// from Meta's own injected scripts (not our code) and are harmless, but they
// surface as uncaught "Script error." in telemetry/Clarity and inflate the
// reported error rate. We swallow them so they don't pollute monitoring or
// trigger error UIs.
const WEBVIEW_NOISE = [
  'java object is gone',
  'webkit.messagehandlers',
  'enablebuttonsclicked',
  "evaluating 'window.webkit",
  'error invoking postmessage',
]

function isWebviewNoise(message?: string): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return WEBVIEW_NOISE.some((needle) => lower.includes(needle))
}

/** At most 5 reports per page load, once per distinct message. */
const reported = new Set<string>()
function report(kind: string, message: string, stack?: string, file?: string) {
  if (!message || reported.size >= 5 || reported.has(message)) return
  if (/ResizeObserver loop|Script error\.?$|Non-Error promise rejection/i.test(message)) return
  reported.add(message)
  try {
    fetch('/api/telemetry/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, message, stack, file, path: location.pathname }), keepalive: true }).catch(() => null)
  } catch {
    // Reporting is best effort
  }
}

export default function ChunkErrorHandler() {
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (isWebviewNoise(e.message)) {
        e.stopImmediatePropagation?.()
        e.preventDefault()
        return
      }

      const isChunkError =
        e.message?.includes('ChunkLoadError') ||
        e.message?.includes('Loading chunk') ||
        (e.filename?.includes('_next/static/chunks') && e.message?.includes('MIME type'))

      if (isChunkError) {
        window.location.reload()
        return
      }
      report('error', e.message, e.error instanceof Error ? e.error.stack : undefined, e.filename)
    }

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      if (isWebviewNoise(e.reason?.message)) {
        e.preventDefault()
        return
      }
      if (e.reason?.name === 'ChunkLoadError' || e.reason?.message?.includes('Loading chunk')) {
        window.location.reload()
        return
      }
      const reason = e.reason
      report('unhandledrejection', reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '', reason instanceof Error ? reason.stack : undefined)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
