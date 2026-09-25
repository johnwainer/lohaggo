import { createSign } from 'crypto'
import { prisma } from '@/lib/prisma'
import { decryptConfig, encryptConfig } from '@/lib/secure-config'
import type { Period } from '@/lib/analytics/core'

/**
 * Google Analytics 4 inside the admin, through the Data API with a service account (read-only
 * scope). The account's JSON key is stored encrypted; the token is minted with a signed JWT, no SDK.
 */

type ServiceAccount = { client_email: string; private_key: string; project_id?: string }

export class Ga4Error extends Error {}

export async function getGa4Settings() {
  const row = await prisma.analyticsSettings.findUnique({ where: { id: 'platform' } }).catch(() => null)
  let account: ServiceAccount | null = null
  try { account = row?.ga4CredentialsEncrypted ? decryptConfig<ServiceAccount>(row.ga4CredentialsEncrypted) : null } catch { account = null }
  return { propertyId: row?.ga4PropertyId ?? null, account, updatedByEmail: row?.updatedByEmail ?? null, updatedAt: row?.updatedAt ?? null }
}

/** Validates the pasted JSON key (it must be a service account) before storing it encrypted. */
export function parseServiceAccount(raw: string): ServiceAccount {
  let o: Record<string, unknown>
  try { o = JSON.parse(raw) } catch { throw new Ga4Error('El archivo de la cuenta de servicio no es un JSON válido') }
  if (o.type !== 'service_account' || typeof o.client_email !== 'string' || typeof o.private_key !== 'string' || !o.private_key.includes('PRIVATE KEY')) {
    throw new Ga4Error('Ese JSON no es la clave de una cuenta de servicio de Google')
  }
  return { client_email: o.client_email, private_key: o.private_key, project_id: typeof o.project_id === 'string' ? o.project_id : undefined }
}

export async function saveGa4Settings(input: { propertyId?: string | null; credentials?: string | null; email: string }) {
  const data: Record<string, unknown> = { updatedByEmail: input.email }
  if (input.propertyId !== undefined) {
    const id = (input.propertyId || '').trim().replace(/^properties\//, '')
    if (id && !/^\d{5,15}$/.test(id)) throw new Ga4Error('El ID de propiedad de GA4 son solo números (Administrar → Detalles de la propiedad)')
    data.ga4PropertyId = id || null
  }
  if (input.credentials !== undefined) data.ga4CredentialsEncrypted = input.credentials ? encryptConfig(parseServiceAccount(input.credentials)) : null
  await prisma.analyticsSettings.upsert({ where: { id: 'platform' }, create: { id: 'platform', ...data }, update: data })
  tokenCache = null
}

let tokenCache: { token: string; exp: number; email: string } | null = null

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

async function accessToken(account: ServiceAccount) {
  if (tokenCache && tokenCache.email === account.client_email && tokenCache.exp > Date.now() + 60_000) return tokenCache.token
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claim}`)
  const jwt = `${header}.${claim}.${b64url(signer.sign(account.private_key))}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }), cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Ga4Error(`Google rechazó la cuenta de servicio: ${data.error_description || data.error || res.status}`)
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000, email: account.client_email }
  return tokenCache.token
}

type Report = { dimensionHeaders?: Array<{ name: string }>; metricHeaders?: Array<{ name: string }>; rows?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }> }

async function runReport(propertyId: string, token: string, body: Record<string, unknown>): Promise<Report> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || String(res.status)
    if (res.status === 403) throw new Ga4Error(`La cuenta de servicio no tiene acceso a la propiedad: agrégala como Lector en GA4 (Administrar → Acceso a la propiedad). ${msg}`)
    throw new Ga4Error(`GA4: ${msg}`)
  }
  return data as Report
}

const rows = (r: Report) => (r.rows ?? []).map((row) => ({ dims: (row.dimensionValues ?? []).map((d) => d.value), mets: (row.metricValues ?? []).map((m) => Number(m.value)) }))
const gaDate = (d: Date) => new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10)

/** Website traffic for the period (and the previous one) straight from GA4. */
export async function trafficTab(p: Period) {
  const s = await getGa4Settings()
  if (!s.propertyId || !s.account) return { configured: false as const }
  const token = await accessToken(s.account)
  const last = new Date(p.to.getTime() - 1)
  const range = { startDate: gaDate(p.from), endDate: gaDate(last) }
  const prevRange = { startDate: gaDate(p.prevFrom), endDate: gaDate(new Date(p.prevTo.getTime() - 1)) }
  const metrics = ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagementRate', 'averageSessionDuration'].map((name) => ({ name }))
  const [totals, prev, daily, pages, channels, sources, devices, cities] = await Promise.all([
    runReport(s.propertyId, token, { dateRanges: [range], metrics }),
    runReport(s.propertyId, token, { dateRanges: [prevRange], metrics }),
    runReport(s.propertyId, token, { dateRanges: [range], dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }),
    runReport(s.propertyId, token, { dateRanges: [range], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 15 }),
    runReport(s.propertyId, token, { dateRanges: [range], dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
    runReport(s.propertyId, token, { dateRanges: [range], dimensions: [{ name: 'sessionSourceMedium' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 12 }),
    runReport(s.propertyId, token, { dateRanges: [range], dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }] }),
    runReport(s.propertyId, token, { dateRanges: [range], dimensions: [{ name: 'city' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 10 }),
  ])
  const t = rows(totals)[0]?.mets ?? []
  const pv = rows(prev)[0]?.mets ?? []
  const pct = (a?: number, b?: number) => (!b ? (a ? null : 0) : Math.round((((a ?? 0) - b) / b) * 1000) / 10)
  return {
    configured: true as const,
    kpis: {
      users: { value: t[0] ?? 0, change: pct(t[0], pv[0]) },
      newUsers: { value: t[1] ?? 0, change: pct(t[1], pv[1]) },
      sessions: { value: t[2] ?? 0, change: pct(t[2], pv[2]) },
      pageviews: { value: t[3] ?? 0, change: pct(t[3], pv[3]) },
      engagementRate: t[4] != null ? Math.round(t[4] * 1000) / 10 : null,
      avgSessionSeconds: t[5] != null ? Math.round(t[5]) : null,
    },
    daily: rows(daily).map((r) => ({ d: `${r.dims[0].slice(0, 4)}-${r.dims[0].slice(4, 6)}-${r.dims[0].slice(6, 8)}`, users: r.mets[0], sessions: r.mets[1] })),
    pages: rows(pages).map((r) => ({ path: r.dims[0], views: r.mets[0], users: r.mets[1] })),
    channels: rows(channels).map((r) => ({ channel: r.dims[0], sessions: r.mets[0], users: r.mets[1] })),
    sources: rows(sources).map((r) => ({ source: r.dims[0], sessions: r.mets[0] })),
    devices: rows(devices).map((r) => ({ device: r.dims[0], users: r.mets[0] })),
    cities: rows(cities).map((r) => ({ city: r.dims[0], users: r.mets[0] })),
  }
}
