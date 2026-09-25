import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getAiSettings, getAiSettingsRow, maskKey, saveAiSettings } from '@/lib/ai/settings'
import { probeModel } from '@/lib/ai/anthropic'
import { prisma } from '@/lib/prisma'
import { VOYAGE_MODELS } from '@/lib/ai/models'
import { getProviderStates, reasonLabel } from '@/lib/ai/providers/state'
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers/types'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const row = await getAiSettingsRow()
  const s = await getAiSettings(true)
  const states = await getProviderStates(true)
  return NextResponse.json({
    settings: {
      anthropicKey: maskKey(s.anthropicKey),
      voyageKey: maskKey(s.voyageKey),
      defaultModel: s.defaultModel,
      fallbackModel: s.fallbackModel,
      embeddingModel: s.embeddingModel,
      allowAgentModelOverride: s.allowAgentModelOverride,
      auxDailyBudgetUsd: s.auxDailyBudgetUsd,
      openaiKey: maskKey(s.openaiKey),
      openaiModel: s.openaiModel,
      openaiFallbackModel: s.openaiFallbackModel,
      providerOrder: s.providerOrder,
      failoverEnabled: s.failoverEnabled,
      defaultModelCheckedAt: row.defaultModelCheckedAt,
      defaultModelCheckOk: row.defaultModelCheckOk,
      updatedByEmail: row.updatedByEmail,
      updatedAt: row.updatedAt,
    },
    voyageModels: VOYAGE_MODELS,
    providers: PROVIDERS.map((p) => {
      const st = states[p]
      return { provider: p, status: st.status, reason: st.reason, reasonLabel: reasonLabel(st.reason), detail: st.detail, downUntil: st.downUntil, lastErrorAt: st.lastErrorAt, lastOkAt: st.lastOkAt, failures: st.failures }
    }),
  })
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const body = await request.json().catch(() => ({}))

  const embeddingModel = typeof body.embeddingModel === 'string' ? body.embeddingModel : undefined
  if (embeddingModel && !VOYAGE_MODELS.some((m) => m.id === embeddingModel)) {
    return NextResponse.json({ error: 'Modelo de embeddings no soportado' }, { status: 400 })
  }
  const aux = body.auxDailyBudgetUsd === undefined ? undefined : Number(body.auxDailyBudgetUsd)
  if (aux !== undefined && (!Number.isFinite(aux) || aux < 0)) return NextResponse.json({ error: 'Tope diario inválido' }, { status: 400 })

  const order = Array.isArray(body.providerOrder) ? body.providerOrder.filter((p: unknown): p is ProviderId => PROVIDERS.includes(p as ProviderId)) : undefined
  if (order && order.length !== PROVIDERS.length) return NextResponse.json({ error: 'Orden de proveedores inválido' }, { status: 400 })
  const modelId = (v: unknown) => (typeof v === 'string' && /^[\w.:-]{1,80}$/.test(v.trim()) ? v.trim() : undefined)

  const before = await getAiSettings(true)
  await saveAiSettings({
    anthropicKey: typeof body.anthropicKey === 'string' || body.anthropicKey === null ? body.anthropicKey : undefined,
    voyageKey: typeof body.voyageKey === 'string' || body.voyageKey === null ? body.voyageKey : undefined,
    defaultModel: typeof body.defaultModel === 'string' ? body.defaultModel.trim() : undefined,
    fallbackModel: typeof body.fallbackModel === 'string' ? body.fallbackModel.trim() : undefined,
    embeddingModel,
    allowAgentModelOverride: typeof body.allowAgentModelOverride === 'boolean' ? body.allowAgentModelOverride : undefined,
    auxDailyBudgetUsd: aux,
    openaiKey: typeof body.openaiKey === 'string' || body.openaiKey === null ? body.openaiKey : undefined,
    openaiModel: modelId(body.openaiModel),
    openaiFallbackModel: modelId(body.openaiFallbackModel),
    providerOrder: order,
    failoverEnabled: typeof body.failoverEnabled === 'boolean' ? body.failoverEnabled : undefined,
    updatedByEmail: admin.email,
  })

  // The default model is verified against the API every time it (or the key) changes
  const after = await getAiSettings(true)
  let check: Awaited<ReturnType<typeof probeModel>> | null = null
  if (after.anthropicKey && (after.defaultModel !== before.defaultModel || after.anthropicKey !== before.anthropicKey)) {
    check = await probeModel(after.defaultModel)
    await prisma.aiSettings.update({ where: { id: 'platform' }, data: { defaultModelCheckedAt: new Date(), defaultModelCheckOk: check.ok } })
  }
  // Same for OpenAI's main model: a wrong id would only show up the day Claude fails
  let openaiCheck: Awaited<ReturnType<typeof probeModel>> | null = null
  if (after.openaiKey && (after.openaiModel !== before.openaiModel || after.openaiKey !== before.openaiKey)) openaiCheck = await probeModel(after.openaiModel)

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'AI_SETTINGS_UPDATE',
    entityType: 'AiSettings',
    entityId: 'platform',
    details: JSON.stringify({
      anthropicKeyChanged: body.anthropicKey !== undefined,
      voyageKeyChanged: body.voyageKey !== undefined,
      openaiKeyChanged: body.openaiKey !== undefined,
      openaiModel: after.openaiModel,
      providerOrder: after.providerOrder,
      failoverEnabled: after.failoverEnabled,
      defaultModel: after.defaultModel,
      fallbackModel: after.fallbackModel,
    }),
    request,
  })
  return NextResponse.json({ ok: true, defaultModelCheck: check, openaiModelCheck: openaiCheck })
}
