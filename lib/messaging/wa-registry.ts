/**
 * Runtime registry of WhatsApp templates: name → { sid, status, category } read from Twilio Content, so a
 * template starts being used the day Meta approves it, without touching code. Cached 30 min in memory and
 * in the Next data cache (tag `wa-templates`); «Refrescar estado» in the admin invalidates both.
 */
import { unstable_cache, revalidateTag } from 'next/cache'
import { createLogger } from '@/lib/logger'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { sendWhatsAppTemplate } from '@/lib/messaging/providers'
import { WA_CATALOG } from '@/lib/messaging/wa-catalog'
import {
  LEGACY_FALLBACK, declaredVars, missingVars, renderForInbox, selectTemplate,
  type Candidate, type RegistryEntry,
} from '@/lib/messaging/wa-core'

const logger = createLogger('wa-registry')

export const WA_TEMPLATES_TAG = 'wa-templates'
const TTL_MS = 30 * 60_000
const CONTENT = 'https://content.twilio.com/v1'

/** Templates outside the catalog that the code still sends by name. */
export const EXTRA_TEMPLATE_NAMES = ['reserva_confirmada_cliente', 'solicitud_enviada_cliente', 'reserva_cancelada']

/** Names whose Meta state matters: the catalog, the legacy fallbacks and the extra ones. */
export function trackedNames(): Set<string> {
  return new Set([...WA_CATALOG.map((t) => t.name), ...Object.values(LEGACY_FALLBACK).map((l) => l.name), ...EXTRA_TEMPLATE_NAMES])
}

/** Twilio credentials: the stored provider config, or the env vars in local development. */
export async function twilioContentAuth(): Promise<string | null> {
  const cfg = (await getMessagingProviderRuntimeConfig().catch(() => null))?.twilio?.config
  const sid = cfg?.accountSid || process.env.TWILIO_ACCOUNT_SID
  const token = cfg?.authToken || process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
}

type RawContent = {
  sid: string
  friendly_name: string
  variables?: Record<string, string>
  types?: Record<string, { body?: string; title?: string }>
  approval_requests?: { name?: string; status?: string; category?: string; rejection_reason?: string } | null
}

function bodyOf(types: RawContent['types']): string | null {
  for (const t of Object.values(types ?? {})) {
    const text = t?.body || t?.title
    if (text) return text
  }
  return null
}

async function getJson(url: string, auth: string) {
  const res = await fetch(url, { headers: { Authorization: auth }, cache: 'no-store' })
  if (!res.ok) throw new Error(`Twilio ${res.status} en ${url.replace(CONTENT, '')}`)
  return res.json()
}

async function listAll(auth: string, path: 'ContentAndApprovals' | 'Content'): Promise<RawContent[]> {
  const out: RawContent[] = []
  let url: string | null = `${CONTENT}/${path}?PageSize=200`
  for (let page = 0; url && page < 20; page++) {
    const data = await getJson(url, auth)
    out.push(...((data.contents ?? []) as RawContent[]))
    url = data.meta?.next_page_url ?? null
  }
  return out
}

async function approvalOf(auth: string, sid: string) {
  const d = await getJson(`${CONTENT}/Content/${sid}/ApprovalRequests`, auth).catch(() => null)
  return d?.whatsapp ?? null
}

function toEntry(c: RawContent, approval: RawContent['approval_requests']): RegistryEntry {
  return {
    name: c.friendly_name,
    sid: c.sid,
    status: String(approval?.status || 'unsubmitted').toLowerCase(),
    category: approval?.category ? String(approval.category).toUpperCase() : null,
    reason: approval?.rejection_reason ? String(approval.rejection_reason) : null,
    body: bodyOf(c.types),
    vars: Object.keys(c.variables ?? {}),
  }
}

/**
 * Reads every tracked template from Twilio. ContentAndApprovals brings the approval inline; if that endpoint
 * fails, the plain list plus one ApprovalRequests call per tracked template (8 at a time). Throws on error so
 * a failure is never cached.
 */
export async function fetchRegistryFromTwilio(): Promise<RegistryEntry[]> {
  const auth = await twilioContentAuth()
  if (!auth) return []
  const tracked = trackedNames()
  try {
    const rows = await listAll(auth, 'ContentAndApprovals')
    if (rows.length && rows.some((r) => r.approval_requests !== undefined)) {
      return rows.filter((r) => tracked.has(r.friendly_name) || tracked.has(String(r.approval_requests?.name ?? ''))).map((r) => toEntry(r, r.approval_requests))
    }
  } catch (err) {
    logger.warn('ContentAndApprovals failed; falling back to per-template approvals', { err: err instanceof Error ? err.message : err })
  }
  const rows = (await listAll(auth, 'Content')).filter((r) => tracked.has(r.friendly_name))
  const out: RegistryEntry[] = []
  for (let i = 0; i < rows.length; i += 8) {
    const chunk = rows.slice(i, i + 8)
    const approvals = await Promise.all(chunk.map((r) => approvalOf(auth, r.sid)))
    chunk.forEach((r, j) => out.push(toEntry(r, approvals[j])))
  }
  return out
}

let memory: { at: number; entries: RegistryEntry[] } | null = null

const cachedFetch = unstable_cache(fetchRegistryFromTwilio, ['wa-registry-v1'], { revalidate: TTL_MS / 1000, tags: [WA_TEMPLATES_TAG] })

/** name (friendly and WhatsApp) → entry. Never throws: on error the last good copy, or an empty registry. */
export async function getWaRegistry(opts: { fresh?: boolean } = {}): Promise<Map<string, RegistryEntry>> {
  if (!opts.fresh && memory && Date.now() - memory.at < TTL_MS) return indexed(memory.entries)
  try {
    let entries: RegistryEntry[]
    try {
      entries = opts.fresh ? await fetchRegistryFromTwilio() : await cachedFetch()
    } catch (err) {
      // Outside a Next request (scripts, tests) the data cache is not available
      if (err instanceof Error && /incrementalCache|static generation store|unstable_cache/i.test(err.message)) entries = await fetchRegistryFromTwilio()
      else throw err
    }
    memory = { at: Date.now(), entries }
    return indexed(entries)
  } catch (err) {
    logger.warn('WhatsApp template registry unavailable', { err: err instanceof Error ? err.message : err })
    return indexed(memory?.entries ?? [])
  }
}

function indexed(entries: RegistryEntry[]) {
  const map = new Map<string, RegistryEntry>()
  // An approved copy wins over an older rejected one with the same name
  const rank = (e: RegistryEntry) => (e.status === 'approved' ? 2 : e.status === 'pending' || e.status === 'received' ? 1 : 0)
  for (const e of entries) {
    const current = map.get(e.name)
    if (!current || rank(e) > rank(current)) map.set(e.name, e)
  }
  return map
}

/** «Refrescar estado»: drops both caches and reads Twilio again. */
export async function refreshWaRegistry() {
  memory = null
  try { revalidateTag(WA_TEMPLATES_TAG, { expire: 0 }) } catch { /* outside a request */ }
  return getWaRegistry({ fresh: true })
}

/** Test hook. */
export function __resetWaRegistryMemory(entries?: RegistryEntry[]) {
  memory = entries ? { at: Date.now(), entries } : null
}

export type TemplateSendResult =
  | { ok: true; name: string; sid: string; category: string; via: 'utility' | 'marketing' | 'legacy'; vars: Record<string, string>; rendered: string; providerMessageId: string | null; requested: string }
  | { ok: false; skipped: 'not_approved' | 'marketing_blocked' | 'missing_vars'; requested: string; missing?: string[] }
  | { ok: false; skipped?: undefined; error: string; errorCode?: string; requested: string; name?: string }

/**
 * Sends the first usable template of the candidates (see selectTemplate). Never throws. Does not check
 * preferences, dedupe nor record the conversation: that is lib/messaging/wa-send.ts.
 */
export async function sendTemplateCandidates(candidates: Candidate[], phone: string, opts: { allowMarketing: boolean }): Promise<TemplateSendResult> {
  const requested = candidates[0]?.name ?? ''
  try {
    const registry = await getWaRegistry()
    const sel = selectTemplate(candidates, (n) => registry.get(n), opts)
    if (!sel.ok) return { ok: false, skipped: sel.reason, requested }
    const missing = missingVars(declaredVars(sel.name, registry.get(sel.name)), sel.vars)
    if (missing.length) {
      logger.error('WhatsApp template not sent: missing variables', { template: sel.name, requested, missing })
      return { ok: false, skipped: 'missing_vars', requested, missing }
    }
    const cfg = await getMessagingProviderRuntimeConfig()
    const res = await sendWhatsAppTemplate(phone, sel.sid, sel.vars, cfg.twilio)
    if (!res.ok) return { ok: false, error: res.errorMessage || 'Twilio no aceptó la plantilla', errorCode: res.errorCode, requested, name: sel.name }
    return { ok: true, name: sel.name, sid: sel.sid, category: sel.category, via: sel.via, vars: sel.vars, rendered: renderForInbox(sel.name, sel.body, sel.vars), providerMessageId: res.providerMessageId ?? null, requested }
  } catch (err) {
    logger.error('WhatsApp template send threw', { requested, err: err instanceof Error ? err.message : err })
    return { ok: false, error: err instanceof Error ? err.message : 'error', requested }
  }
}

/** One catalog template by name (with its legacy fallback): only if Meta approved it. Never throws. */
export async function sendCatalogTemplate(name: string, phone: string, vars: Record<string, string>, opts: { allowMarketing?: boolean } = {}) {
  return sendTemplateCandidates([{ name, vars }], phone, { allowMarketing: opts.allowMarketing ?? false })
}

export type CatalogStatusRow = {
  code: string
  name: string
  category: string
  finalCategory: string | null
  status: string
  reason: string | null
  sid: string | null
  usage: string
  recategorized: boolean
}

/** Catalog with Meta's state, for the admin screen and Haggo. */
export async function catalogStatus(opts: { fresh?: boolean } = {}): Promise<CatalogStatusRow[]> {
  const { WA_TEMPLATE_USAGE } = await import('@/lib/messaging/wa-core')
  const registry = opts.fresh ? await refreshWaRegistry() : await getWaRegistry()
  return WA_CATALOG.map((t) => {
    const e = registry.get(t.name)
    const finalCategory = e?.category ?? null
    return {
      code: t.code,
      name: t.name,
      category: t.category,
      finalCategory,
      status: e ? e.status : 'missing',
      reason: e?.reason ?? null,
      sid: e?.sid ?? null,
      usage: WA_TEMPLATE_USAGE[t.name] ?? '',
      recategorized: Boolean(e && e.status === 'approved' && finalCategory && finalCategory !== t.category),
    }
  })
}
