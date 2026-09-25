import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { getAiSettings, getAiSettingsRow, anthropicClient, openaiClient } from '@/lib/ai/settings'
import { describeApiError, isOpenAIModel, listAnthropicModels, probeModel } from '@/lib/ai/anthropic'
import { listOpenAIModels } from '@/lib/ai/providers/openai'
import { OPENAI_STATIC_MODELS, STATIC_MODELS, type ModelOption } from '@/lib/ai/models'
import { aiWorkspacesWith, getAiAccess } from '@/lib/ai/permissions'

const CACHE_MS = 60 * 60 * 1000

/**
 * Models available to this account, from GET /v1/models (cached 1h). Static list only as a fallback.
 * `?provider=openai` lists OpenAI's; the default is Claude's.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scope = aiWorkspacesWith(await getAiAccess(admin), 'ai.view')
  if (scope !== null && scope.length === 0) return NextResponse.json({ error: 'Sin acceso a agentes IA' }, { status: 403 })
  const refresh = request.nextUrl.searchParams.get('refresh') === '1'
  const openai = request.nextUrl.searchParams.get('provider') === 'openai'
  const settings = await getAiSettings()
  const row = await getAiSettingsRow()

  const key = openai ? settings.openaiKey : settings.anthropicKey
  const fallback = openai ? OPENAI_STATIC_MODELS : STATIC_MODELS
  const cachedList = openai ? row.openaiModelsCache : row.modelsCache
  const cachedAt = openai ? row.openaiModelsCachedAt : row.modelsCachedAt
  if (!key) {
    return NextResponse.json({ models: fallback, source: 'static', warning: `Sin clave de ${openai ? 'OpenAI' : 'Anthropic'}: lista de respaldo` })
  }
  const fresh = cachedAt && Date.now() - cachedAt.getTime() < CACHE_MS
  if (!refresh && fresh && Array.isArray(cachedList)) {
    return NextResponse.json({ models: cachedList, source: 'api', cachedAt })
  }
  try {
    const list = openai ? await listOpenAIModels(openaiClient(key)) : await listAnthropicModels(anthropicClient(key))
    const models: ModelOption[] = list.map((m) => ({ id: m.id, displayName: m.displayName, source: 'api' }))
    const json = models as unknown as Prisma.InputJsonValue
    await prisma.aiSettings.update({
      where: { id: 'platform' },
      data: openai ? { openaiModelsCache: json, openaiModelsCachedAt: new Date() } : { modelsCache: json, modelsCachedAt: new Date() },
    })
    return NextResponse.json({ models, source: 'api', cachedAt: new Date() })
  } catch (err) {
    const cached = Array.isArray(cachedList) ? cachedList : null
    return NextResponse.json({ models: cached || fallback, source: cached ? 'api-cache' : 'static', warning: describeApiError(err) })
  }
}

/** "Probar modelo": on the provider the model belongs to. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const model = typeof body.model === 'string' ? body.model.trim() : ''
  if (!model) return NextResponse.json({ error: 'Modelo requerido' }, { status: 400 })
  const settings = await getAiSettings()
  const openai = isOpenAIModel(model)
  if (!(openai ? settings.openaiKey : settings.anthropicKey)) return NextResponse.json({ ok: false, error: `Sin clave de ${openai ? 'OpenAI' : 'Anthropic'}` })
  const result = await probeModel(model)
  if (model === settings.defaultModel) {
    await prisma.aiSettings.update({ where: { id: 'platform' }, data: { defaultModelCheckedAt: new Date(), defaultModelCheckOk: result.ok } })
  }
  return NextResponse.json(result)
}
