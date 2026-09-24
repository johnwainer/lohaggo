import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth } from '@/lib/marketing/permissions'
import { maskKey } from '@/lib/ai/settings'
import { IMAGE_PROVIDERS, PROVIDER_IDS, type ImageProvider } from '@/lib/marketing/images-core'
import { ImageError, getImageSettings, providerReady, saveImageSettings, searchPexels } from '@/lib/marketing/images'

export const dynamic = 'force-dynamic'

/** Image sources of the platform. Keys and provider: superadmin only; everyone else sees what is available. */
export async function GET() {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const s = await getImageSettings(true)
  const ready = providerReady(s)
  const summary = {
    pexels: Boolean(s.keys.pexels),
    provider: s.provider,
    providerLabel: IMAGE_PROVIDERS[s.provider].label,
    providerReady: ready.ready,
    providerReason: ready.reason,
    supportsReference: IMAGE_PROVIDERS[s.provider].supportsReference,
    costPerImageUsd: s.costPerImageUsd,
  }
  if (!auth.access.isSuperAdmin) return NextResponse.json({ summary, canEdit: false })
  return NextResponse.json({
    summary,
    canEdit: true,
    settings: {
      keys: Object.fromEntries(['pexels', 'gemini', 'openai', 'cloudflare'].map((k) => [k, maskKey(s.keys[k as keyof typeof s.keys] ?? null)])),
      provider: s.provider,
      models: Object.fromEntries(PROVIDER_IDS.filter((p) => p !== 'none').map((p) => [p, s.models[p] || IMAGE_PROVIDERS[p].defaultModel])),
      cloudflareAccountId: s.cloudflareAccountId,
      costPerImageUsd: s.costPerImageUsd,
    },
    providers: PROVIDER_IDS.map((id) => ({ id, ...IMAGE_PROVIDERS[id] })),
  })
}

export async function PUT(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  if (!auth.access.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (b.action === 'test_pexels') {
    try {
      const r = await searchPexels('home repair', 'landscape', 1, 1, typeof b.key === 'string' && b.key.trim() ? b.key.trim() : undefined)
      return NextResponse.json({ ok: true, total: r.total })
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof ImageError ? err.message : 'No se pudo consultar Pexels' })
    }
  }
  const keys: Record<string, string | null> = {}
  for (const k of ['pexels', 'gemini', 'openai', 'cloudflare']) {
    const v = b.keys?.[k]
    if (typeof v === 'string' && v.trim()) keys[k] = v.trim().slice(0, 400)
    else if (v === null) keys[k] = null
  }
  const provider = PROVIDER_IDS.includes(b.provider) ? (b.provider as ImageProvider) : undefined
  const models: Partial<Record<ImageProvider, string>> = {}
  for (const p of PROVIDER_IDS) if (typeof b.models?.[p] === 'string' && /^[\w@./:-]{1,120}$/.test(b.models[p].trim())) models[p] = b.models[p].trim()
  const cost = b.costPerImageUsd === undefined ? undefined : Number(b.costPerImageUsd)
  if (cost !== undefined && (!Number.isFinite(cost) || cost < 0 || cost > 5)) return NextResponse.json({ error: 'Costo por imagen inválido' }, { status: 400 })
  const accountId = b.cloudflareAccountId === undefined ? undefined : typeof b.cloudflareAccountId === 'string' && /^[a-f0-9]{0,64}$/i.test(b.cloudflareAccountId.trim()) ? b.cloudflareAccountId.trim() : null
  await saveImageSettings({ keys, provider, models, cloudflareAccountId: accountId, costPerImageUsd: cost, updatedByEmail: auth.admin.email })
  await auditAdminAction({
    actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_IMAGE_SETTINGS', entityType: 'MarketingImageSettings', entityId: 'platform',
    details: JSON.stringify({ provider, keysChanged: Object.keys(keys), models }), request,
  })
  return NextResponse.json({ ok: true })
}
