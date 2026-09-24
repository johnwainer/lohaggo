import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { invalidatePricing } from '@/lib/ai/calls'
import { DEFAULT_PRICING } from '@/lib/ai/pricing'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const rows = await prisma.aiPricing.findMany({ orderBy: [{ provider: 'asc' }, { model: 'asc' }] })
  const known = new Set(rows.map((r) => `${r.provider}:${r.model}`))
  const defaults = Object.entries(DEFAULT_PRICING)
    .filter(([k]) => !known.has(k))
    .map(([k, p]) => ({ id: null, provider: k.split(':')[0], model: k.split(':').slice(1).join(':'), ...p }))
  return NextResponse.json({ pricing: [...rows, ...defaults] })
}

/** Upserts one row: { provider, model, inputPerMTok, outputPerMTok, cacheReadPerMTok, cacheWritePerMTok } or { delete: true }. */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const provider = body.provider === 'voyage' ? 'voyage' : body.provider === 'anthropic' ? 'anthropic' : null
  const model = typeof body.model === 'string' ? body.model.trim() : ''
  if (!provider || !model) return NextResponse.json({ error: 'Proveedor y modelo requeridos' }, { status: 400 })

  if (body.delete) {
    await prisma.aiPricing.deleteMany({ where: { provider, model } })
  } else {
    const nums = ['inputPerMTok', 'outputPerMTok', 'cacheReadPerMTok', 'cacheWritePerMTok'].map((k) => Number(body[k] ?? 0))
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return NextResponse.json({ error: 'Tarifas inválidas' }, { status: 400 })
    const [inputPerMTok, outputPerMTok, cacheReadPerMTok, cacheWritePerMTok] = nums
    await prisma.aiPricing.upsert({
      where: { provider_model: { provider, model } },
      create: { provider, model, inputPerMTok, outputPerMTok, cacheReadPerMTok, cacheWritePerMTok },
      update: { inputPerMTok, outputPerMTok, cacheReadPerMTok, cacheWritePerMTok },
    })
  }
  invalidatePricing()
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'AI_PRICING_UPDATE', entityType: 'AiPricing', entityId: `${provider}:${model}`, details: JSON.stringify(body), request })
  return NextResponse.json({ ok: true })
}
