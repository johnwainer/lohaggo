import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getAiSettings, getAiSettingsRow, maskKey, saveAiSettings } from '@/lib/ai/settings'
import { probeModel } from '@/lib/ai/anthropic'
import { prisma } from '@/lib/prisma'
import { VOYAGE_MODELS } from '@/lib/ai/models'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const row = await getAiSettingsRow()
  const s = await getAiSettings(true)
  return NextResponse.json({
    settings: {
      anthropicKey: maskKey(s.anthropicKey),
      voyageKey: maskKey(s.voyageKey),
      defaultModel: s.defaultModel,
      fallbackModel: s.fallbackModel,
      embeddingModel: s.embeddingModel,
      allowAgentModelOverride: s.allowAgentModelOverride,
      auxDailyBudgetUsd: s.auxDailyBudgetUsd,
      defaultModelCheckedAt: row.defaultModelCheckedAt,
      defaultModelCheckOk: row.defaultModelCheckOk,
      updatedByEmail: row.updatedByEmail,
      updatedAt: row.updatedAt,
    },
    voyageModels: VOYAGE_MODELS,
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

  const before = await getAiSettings(true)
  await saveAiSettings({
    anthropicKey: typeof body.anthropicKey === 'string' || body.anthropicKey === null ? body.anthropicKey : undefined,
    voyageKey: typeof body.voyageKey === 'string' || body.voyageKey === null ? body.voyageKey : undefined,
    defaultModel: typeof body.defaultModel === 'string' ? body.defaultModel.trim() : undefined,
    fallbackModel: typeof body.fallbackModel === 'string' ? body.fallbackModel.trim() : undefined,
    embeddingModel,
    allowAgentModelOverride: typeof body.allowAgentModelOverride === 'boolean' ? body.allowAgentModelOverride : undefined,
    auxDailyBudgetUsd: aux,
    updatedByEmail: admin.email,
  })

  // The default model is verified against the API every time it (or the key) changes
  const after = await getAiSettings(true)
  let check: Awaited<ReturnType<typeof probeModel>> | null = null
  if (after.anthropicKey && (after.defaultModel !== before.defaultModel || after.anthropicKey !== before.anthropicKey)) {
    check = await probeModel(after.defaultModel)
    await prisma.aiSettings.update({ where: { id: 'platform' }, data: { defaultModelCheckedAt: new Date(), defaultModelCheckOk: check.ok } })
  }

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'AI_SETTINGS_UPDATE',
    entityType: 'AiSettings',
    entityId: 'platform',
    details: JSON.stringify({
      anthropicKeyChanged: body.anthropicKey !== undefined,
      voyageKeyChanged: body.voyageKey !== undefined,
      defaultModel: after.defaultModel,
      fallbackModel: after.fallbackModel,
    }),
    request,
  })
  return NextResponse.json({ ok: true, defaultModelCheck: check })
}
