import crypto from 'crypto'

/**
 * Mercado Pago webhook signature (x-signature: `ts=...,v1=...`). The signed manifest is
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` where `data.id` comes from the QUERY STRING of the
 * notification URL (lowercased when alphanumeric), not from the request id. A part whose value is absent is left out.
 */
export function buildMercadoPagoManifest(input: { dataId?: string | null; requestId?: string | null; ts: string }) {
  const rawId = input.dataId?.trim()
  const id = rawId ? (/^[a-z0-9]+$/i.test(rawId) ? rawId.toLowerCase() : rawId) : null
  return `${id ? `id:${id};` : ''}${input.requestId ? `request-id:${input.requestId};` : ''}ts:${input.ts};`
}

/** Notifications whose signed timestamp is older (or further in the future) than this are replays. */
export const MP_MAX_SIGNATURE_AGE_MS = 10 * 60_000

const normalizeId = (v: string | null | undefined) => {
  const t = v?.trim()
  return t ? (/^[a-z0-9]+$/i.test(t) ? t.toLowerCase() : t) : null
}

/** The body's data.id must be the same one the signature covered (the query-string one). */
export function mercadoPagoIdsMatch(queryId: string | null | undefined, bodyId: unknown): boolean {
  if (bodyId === undefined || bodyId === null) return true
  return normalizeId(String(bodyId)) === normalizeId(queryId)
}

/** MP sends ts in milliseconds; seconds are also accepted (anything below 1e11 is read as seconds). */
export function mercadoPagoTsMs(ts: string): number | null {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return null
  return n < 1e11 ? n * 1000 : n
}

export function verifyMercadoPagoSignature(input: { xSignature: string | null; xRequestId: string | null; dataId: string | null; secret: string | undefined; now?: number }): boolean {
  const { xSignature, xRequestId, dataId, secret } = input
  const now = input.now ?? Date.now()
  if (!xSignature || !xRequestId || !secret) return false
  let ts: string | undefined
  let hash: string | undefined
  for (const part of xSignature.split(',')) {
    const i = part.indexOf('=')
    if (i < 1) continue
    const key = part.slice(0, i).trim()
    const value = part.slice(i + 1).trim()
    if (key === 'ts') ts = value
    else if (key === 'v1') hash = value
  }
  if (!ts || !hash) return false
  const tsMs = mercadoPagoTsMs(ts)
  if (tsMs === null || Math.abs(now - tsMs) > MP_MAX_SIGNATURE_AGE_MS) return false
  const expected = crypto.createHmac('sha256', secret).update(buildMercadoPagoManifest({ dataId, requestId: xRequestId, ts })).digest('hex')
  const a = Buffer.from(hash)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
