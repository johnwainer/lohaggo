/**
 * Sends Lead / Purchase to Meta's Conversions API and GA4's Measurement Protocol, once per event and
 * destination (ConversionEvent is the ledger: its unique key makes a second send a no-op). Credentials are
 * typed in Analítica → Conversiones and stored encrypted. Never throws: a conversion must not break a request.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { decryptConfig, encryptConfig } from '@/lib/secure-config'
import { META_GRAPH_DEFAULT_VERSION } from '@/lib/messaging/provider-config'
import { SITE_URL } from '@/lib/marketing/seo'
import { readTouch } from '@/lib/analytics/attribution-core'
import {
  buildGa4Event, buildMetaEvent, conversionDestinations, conversionEventId,
  type ConversionInput, type ConversionKind,
} from '@/lib/analytics/conversions-core'
import type { BrowserContext } from '@/lib/analytics/touches'

const logger = createLogger('conversions')
const TIMEOUT_MS = 5000

export class ConversionSettingsError extends Error {}

export type ConversionSettings = {
  metaPixelId: string | null
  metaToken: string | null
  metaTestEventCode: string | null
  metaWabaId: string | null
  ga4MeasurementId: string | null
  ga4ApiSecret: string | null
}

let cache: { at: number; value: ConversionSettings } | null = null

export async function getConversionSettings(fresh = false): Promise<ConversionSettings> {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache.value
  const row = await prisma.analyticsSettings.findUnique({ where: { id: 'platform' } }).catch(() => null)
  const dec = (blob: string | null | undefined) => {
    if (!blob) return null
    try { return decryptConfig<{ v: string }>(blob).v || null } catch { return null }
  }
  const value: ConversionSettings = {
    metaPixelId: row?.metaPixelId ?? null,
    metaToken: dec(row?.metaCapiTokenEncrypted),
    metaTestEventCode: row?.metaTestEventCode ?? null,
    metaWabaId: row?.metaWabaId ?? null,
    ga4MeasurementId: row?.ga4MeasurementId ?? null,
    ga4ApiSecret: dec(row?.ga4ApiSecretEncrypted),
  }
  cache = { at: Date.now(), value }
  return value
}

/** Pixel id for the page (the setting, or the old env var while it is not set). */
export async function metaPixelIdForPage(): Promise<string | null> {
  const s = await getConversionSettings().catch(() => null)
  return s?.metaPixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID || null
}

type SettingsInput = {
  metaPixelId?: string | null
  metaToken?: string | null
  metaTestEventCode?: string | null
  metaWabaId?: string | null
  ga4MeasurementId?: string | null
  ga4ApiSecret?: string | null
}

/** Only the fields sent change; an empty string clears one. Secrets are encrypted and never read back. */
export async function saveConversionSettings(input: SettingsInput, email: string) {
  const data: Record<string, unknown> = { updatedByEmail: email }
  const trim = (v: string | null | undefined) => (v ?? '').trim()
  if (input.metaPixelId !== undefined) {
    const v = trim(input.metaPixelId)
    if (v && !/^\d{8,20}$/.test(v)) throw new ConversionSettingsError('El ID del píxel (conjunto de datos) son solo números')
    data.metaPixelId = v || null
  }
  if (input.metaWabaId !== undefined) {
    const v = trim(input.metaWabaId)
    if (v && !/^\d{8,20}$/.test(v)) throw new ConversionSettingsError('El ID de la cuenta de WhatsApp Business son solo números')
    data.metaWabaId = v || null
  }
  if (input.metaTestEventCode !== undefined) {
    const v = trim(input.metaTestEventCode)
    if (v && !/^[A-Z0-9]{4,20}$/i.test(v)) throw new ConversionSettingsError('El código de prueba es como TEST12345')
    data.metaTestEventCode = v || null
  }
  if (input.metaToken !== undefined) {
    const v = trim(input.metaToken)
    if (v && v.length < 50) throw new ConversionSettingsError('Ese token de acceso es demasiado corto')
    data.metaCapiTokenEncrypted = v ? encryptConfig({ v }) : null
  }
  if (input.ga4MeasurementId !== undefined) {
    const v = trim(input.ga4MeasurementId).toUpperCase()
    if (v && !/^G-[A-Z0-9]{4,15}$/.test(v)) throw new ConversionSettingsError('El ID de medición de GA4 empieza por G-')
    data.ga4MeasurementId = v || null
  }
  if (input.ga4ApiSecret !== undefined) {
    const v = trim(input.ga4ApiSecret)
    data.ga4ApiSecretEncrypted = v ? encryptConfig({ v }) : null
  }
  await prisma.analyticsSettings.upsert({ where: { id: 'platform' }, create: { id: 'platform', ...data }, update: data })
  cache = null
}

async function postJson(url: string, body: unknown) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal, cache: 'no-store' })
    const text = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, text: text.slice(0, 500) }
  } finally {
    clearTimeout(timer)
  }
}

/** Claims the ledger row; false when this event already went (or is going) to that destination. */
async function claim(destination: string, input: ConversionInput, entityType: string) {
  try {
    await prisma.conversionEvent.create({
      data: { event: input.kind, destination, eventId: conversionEventId(input.kind, input.entityId), entityType, entityId: input.entityId, value: input.value, status: 'pending' },
    })
    return true
  } catch {
    return false
  }
}

async function settle(destination: string, input: ConversionInput, status: 'sent' | 'failed' | 'skipped', detail: string) {
  await prisma.conversionEvent.update({
    where: { destination_eventId: { destination, eventId: conversionEventId(input.kind, input.entityId) } },
    data: { status, detail: detail.replace(/(access_token|api_secret)=[^&\s"]+/gi, '$1=***').slice(0, 500) },
  }).catch(() => null)
}

async function dispatch(input: ConversionInput, entityType: string, browserSent: boolean) {
  const s = await getConversionSettings()
  const destinations = conversionDestinations({ kind: input.kind, browserSent, meta: Boolean(s.metaPixelId && s.metaToken), ga4: Boolean(s.ga4MeasurementId && s.ga4ApiSecret) })
  for (const destination of destinations) {
    if (!(await claim(destination, input, entityType))) continue
    try {
      if (destination === 'meta_capi') {
        const event = buildMetaEvent(input, { wabaId: s.metaWabaId })
        const url = `https://graph.facebook.com/${META_GRAPH_DEFAULT_VERSION}/${s.metaPixelId}/events?access_token=${encodeURIComponent(s.metaToken as string)}`
        const r = await postJson(url, { data: [event], ...(s.metaTestEventCode ? { test_event_code: s.metaTestEventCode } : {}) })
        await settle(destination, input, r.ok ? 'sent' : 'failed', `${event.action_source} · ${r.status} ${r.text}`)
      } else {
        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(s.ga4MeasurementId as string)}&api_secret=${encodeURIComponent(s.ga4ApiSecret as string)}`
        const r = await postJson(url, buildGa4Event(input))
        await settle(destination, input, r.ok ? 'sent' : 'failed', `${r.status} ${r.text}`)
      }
    } catch (err) {
      await settle(destination, input, 'failed', err instanceof Error ? err.message : 'error')
      logger.warn('Conversion not sent', { destination, kind: input.kind, entityId: input.entityId })
    }
  }
}

/** Lead of a new request. `browserSent`: the page fired the pixel with the same event id (web form). */
export async function sendLeadConversion(serviceRequestId: string, opts: { browser?: BrowserContext | null; browserSent?: boolean } = {}) {
  try {
    const r = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: { id: true, createdAt: true, budget: true, lastTouch: true, serviceId: true, service: { select: { name: true, basePrice: true } }, user: { select: { id: true, email: true, phone: true } } },
    })
    if (!r) return
    await dispatch({
      kind: 'Lead', entityId: r.id, at: r.createdAt, value: r.budget ?? r.service.basePrice ?? null, serviceId: r.serviceId, serviceName: r.service.name,
      user: r.user, touch: readTouch(r.lastTouch), browser: opts.browser ?? null, siteUrl: SITE_URL,
    }, 'ServiceRequest', Boolean(opts.browserSent))
  } catch (err) {
    logger.warn('Lead conversion failed', { serviceRequestId, err: err instanceof Error ? err.message : err })
  }
}

/** Purchase of a booking (completed or paid, whichever comes first; the ledger keeps it to one). */
export async function sendPurchaseConversion(bookingId: string) {
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, totalPrice: true, lastTouch: true, serviceId: true, service: { select: { name: true } }, user: { select: { id: true, email: true, phone: true } } },
    })
    if (!b) return
    await dispatch({
      kind: 'Purchase', entityId: b.id, at: new Date(), value: b.totalPrice, serviceId: b.serviceId, serviceName: b.service.name,
      user: b.user, touch: readTouch(b.lastTouch), browser: null, siteUrl: SITE_URL,
    }, 'Booking', false)
  } catch (err) {
    logger.warn('Purchase conversion failed', { bookingId, err: err instanceof Error ? err.message : err })
  }
}

/** For the settings screen and Haggo: last 30 days by destination, event and status. */
export async function conversionStats(days = 30) {
  const since = new Date(Date.now() - days * 86400_000)
  const rows = await prisma.conversionEvent.groupBy({ by: ['destination', 'event', 'status'], where: { createdAt: { gte: since } }, _count: { _all: true } }).catch(() => [])
  const lastFailed = await prisma.conversionEvent.findFirst({ where: { status: 'failed', createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, select: { destination: true, event: true, detail: true, createdAt: true } }).catch(() => null)
  return { rows: rows.map((r) => ({ destination: r.destination, event: r.event, status: r.status, count: r._count._all })), lastFailed }
}
