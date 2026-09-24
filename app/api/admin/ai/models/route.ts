import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { getAiSettings, getAiSettingsRow, anthropicClient } from '@/lib/ai/settings'
import { describeApiError, listAnthropicModels, probeModel } from '@/lib/ai/anthropic'
import { STATIC_MODELS, type ModelOption } from '@/lib/ai/models'
import { aiWorkspacesWith, getAiAccess } from '@/lib/ai/permissions'

const CACHE_MS = 60 * 60 * 1000

/** Models available to this account, from GET /v1/models (cached 1h). Static list only as a fallback. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scope = aiWorkspacesWith(await getAiAccess(admin), 'ai.view')
  if (scope !== null && scope.length === 0) return NextResponse.json({ error: 'Sin acceso a agentes IA' }, { status: 403 })
  const refresh = request.nextUrl.searchParams.get('refresh') === '1'
  const settings = await getAiSettings()
  const row = await getAiSettingsRow()

  if (!settings.anthropicKey) {
    return NextResponse.json({ models: STATIC_MODELS, source: 'static', warning: 'Sin clave de Anthropic: lista de respaldo' })
  }
  const fresh = row.modelsCachedAt && Date.now() - row.modelsCachedAt.getTime() < CACHE_MS
  if (!refresh && fresh && Array.isArray(row.modelsCache)) {
    return NextResponse.json({ models: row.modelsCache, source: 'api', cachedAt: row.modelsCachedAt })
  }
  try {
    const list = await listAnthropicModels(anthropicClient(settings.anthropicKey))
    const models: ModelOption[] = list.map((m) => ({ id: m.id, displayName: m.displayName, source: 'api' }))
    await prisma.aiSettings.update({
      where: { id: 'platform' },
      data: { modelsCache: models as unknown as Prisma.InputJsonValue, modelsCachedAt: new Date() },
    })
    return NextResponse.json({ models, source: 'api', cachedAt: new Date() })
  } catch (err) {
    const cached = Array.isArray(row.modelsCache) ? row.modelsCache : null
    return NextResponse.json({ models: cached || STATIC_MODELS, source: cached ? 'api-cache' : 'static', warning: describeApiError(err) })
  }
}

/** "Probar modelo" */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const model = typeof body.model === 'string' ? body.model.trim() : ''
  if (!model) return NextResponse.json({ error: 'Modelo requerido' }, { status: 400 })
  const settings = await getAiSettings()
  if (!settings.anthropicKey) return NextResponse.json({ ok: false, error: 'Sin clave de Anthropic' })
  const result = await probeModel(model)
  if (model === settings.defaultModel) {
    await prisma.aiSettings.update({ where: { id: 'platform' }, data: { defaultModelCheckedAt: new Date(), defaultModelCheckOk: result.ok } })
  }
  return NextResponse.json(result)
}
