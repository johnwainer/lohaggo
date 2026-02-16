import { PwaEventName } from '@/lib/pwa/events'

type TrackPwaEventInput = {
  eventName: PwaEventName
  role?: 'CLIENT' | 'PARTNER' | 'ADMIN'
  city?: 'MEDELLIN' | 'BOGOTA' | 'CALI' | 'BARRANQUILLA'
  source?: string
  metadata?: Record<string, unknown>
}

const SESSION_STORAGE_KEY = 'lohaggo_pwa_session_id'

function getSessionId() {
  if (typeof window === 'undefined') return undefined

  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existing) return existing

  const generated = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
  sessionStorage.setItem(SESSION_STORAGE_KEY, generated)
  return generated
}

function detectPlatform() {
  if (typeof window === 'undefined') return undefined
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('android')) return 'android'
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios'
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('mac os')) return 'macos'
  return 'other'
}

function detectBrowser() {
  if (typeof window === 'undefined') return undefined
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('edg/')) return 'edge'
  if (ua.includes('chrome/')) return 'chrome'
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'safari'
  if (ua.includes('firefox/')) return 'firefox'
  return 'other'
}

export function trackPwaEvent(input: TrackPwaEventInput) {
  if (typeof window === 'undefined') return

  const payload = {
    ...input,
    sessionId: getSessionId(),
    platform: detectPlatform(),
    browser: detectBrowser(),
  }

  const body = JSON.stringify(payload)
  const url = '/api/telemetry/pwa'

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(url, blob)
    return
  }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined)
}
