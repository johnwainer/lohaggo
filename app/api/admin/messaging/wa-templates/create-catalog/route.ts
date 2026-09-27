import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { WA_CATALOG, WA_LANGUAGE, contentTypes, type WaCatalogEntry } from '@/lib/messaging/wa-catalog'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function twilioAuth() {
  const cfg = (await getMessagingProviderRuntimeConfig()).twilio?.config
  if (!cfg?.accountSid || !cfg?.authToken) return null
  return `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64')}`
}

/** friendly_name → sid of everything already in Twilio Content (paginated). */
async function existingContent(auth: string) {
  const map = new Map<string, string>()
  let url: string | null = 'https://content.twilio.com/v1/Content?PageSize=200'
  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: auth } })
    if (!res.ok) break
    const data = await res.json()
    for (const c of data.contents ?? []) map.set(c.friendly_name, c.sid)
    url = data.meta?.next_page_url ?? null
  }
  return map
}

async function approvalOf(auth: string, sid: string) {
  const res = await fetch(`https://content.twilio.com/v1/Content/${sid}/ApprovalRequests`, { headers: { Authorization: auth } })
  if (!res.ok) return null
  const d = await res.json()
  return { status: d.whatsapp?.status ?? null, category: d.whatsapp?.category ?? null, reason: d.whatsapp?.rejection_reason ?? null }
}

async function createOne(auth: string, t: WaCatalogEntry) {
  const createRes = await fetch('https://content.twilio.com/v1/Content', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ friendly_name: t.name, language: WA_LANGUAGE, variables: t.variables, types: contentTypes(t) }),
  })
  const created = await createRes.json().catch(() => ({}))
  if (!createRes.ok) return { name: t.name, ok: false as const, step: 'create', error: created?.message ?? JSON.stringify(created).slice(0, 300) }
  const sid: string = created.sid
  const apRes = await fetch(`https://content.twilio.com/v1/Content/${sid}/ApprovalRequests/whatsapp`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: t.name, category: t.category }),
  })
  const ap = await apRes.json().catch(() => ({}))
  if (!apRes.ok) return { name: t.name, ok: false as const, sid, step: 'approval', error: ap?.message ?? JSON.stringify(ap).slice(0, 300) }
  return { name: t.name, ok: true as const, sid, status: ap?.status ?? 'submitted' }
}

async function superAdmin() {
  const admin = await requireAdmin()
  if (!admin) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!admin.isSuperAdmin) return { response: NextResponse.json({ error: 'Solo el superadmin' }, { status: 403 }) }
  return { admin }
}

/** Catalog vs Twilio: which exist, their SID and Meta approval status. */
export async function GET() {
  const a = await superAdmin()
  if ('response' in a) return a.response
  const auth = await twilioAuth()
  if (!auth) return NextResponse.json({ error: 'Twilio no está configurado' }, { status: 500 })
  const existing = await existingContent(auth)
  const rows = []
  for (const t of WA_CATALOG) {
    const sid = existing.get(t.name) ?? null
    rows.push({ code: t.code, name: t.name, category: t.category, sid, approval: sid ? await approvalOf(auth, sid) : null })
  }
  return NextResponse.json({ total: WA_CATALOG.length, created: rows.filter((r) => r.sid).length, rows })
}

/**
 * Creates the catalog templates that do not exist yet and submits them to Meta. Idempotent (skips existing
 * names). Body: { names?: string[], limit?: number } to go in batches.
 */
export async function POST(request: NextRequest) {
  const a = await superAdmin()
  if ('response' in a) return a.response
  const auth = await twilioAuth()
  if (!auth) return NextResponse.json({ error: 'Twilio no está configurado' }, { status: 500 })
  const b = await request.json().catch(() => ({}))
  const names: string[] | null = Array.isArray(b.names) ? b.names.filter((n: unknown) => typeof n === 'string') : null
  const limit = Math.min(Math.max(Number(b.limit) || 20, 1), 30)

  const existing = await existingContent(auth)
  const todo = WA_CATALOG.filter((t) => (!names || names.includes(t.name)) && !existing.has(t.name)).slice(0, limit)
  const results = []
  for (const t of todo) results.push(await createOne(auth, t))

  await auditAdminAction({
    actorId: a.admin.id, actorEmail: a.admin.email, action: 'WA_TEMPLATES_CREATE', entityType: 'WaTemplate',
    details: JSON.stringify({ created: results.filter((r) => r.ok).map((r) => r.name), failed: results.filter((r) => !r.ok).map((r) => r.name) }).slice(0, 2000),
    request,
  })
  const remaining = WA_CATALOG.filter((t) => !existing.has(t.name)).length - results.filter((r) => r.ok).length
  return NextResponse.json({ results, remaining })
}
