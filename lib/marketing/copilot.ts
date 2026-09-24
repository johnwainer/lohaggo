import { prisma } from '@/lib/prisma'
import { callClaude, describeApiError, textOf } from '@/lib/ai/anthropic'
import { getAiSettings } from '@/lib/ai/settings'
import { checkWorkspaceBudget } from '@/lib/ai/limits'
import { SITE_URL, slugify } from '@/lib/marketing/seo'
import { cleanText, maxTokensFor, parseHashtags, parseJson, systemPrompt, userPrompt, type CopilotRequest } from '@/lib/marketing/copilot-core'

export class CopywritingError extends Error {}

let brandCache: { at: number; services: string[]; cities: string[] } | null = null

async function brandContext(workspaceId: string) {
  if (!brandCache || Date.now() - brandCache.at > 10 * 60_000) {
    const [services, cities] = await Promise.all([
      prisma.service.findMany({ select: { name: true }, orderBy: { name: 'asc' }, take: 60 }).catch(() => []),
      prisma.cityConfig.findMany({ where: { status: 'ACTIVE' }, select: { name: true }, orderBy: { order: 'asc' }, take: 20 }).catch(() => []),
    ])
    brandCache = { at: Date.now(), services: services.map((s) => s.name), cities: cities.map((c) => c.name) }
  }
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, isDefault: true } })
  return { brand: ws?.isDefault || !ws ? 'LoHaggo' : ws.name, services: brandCache.services, cities: brandCache.cities, siteUrl: SITE_URL }
}

/** One call to the platform's model; cost logged as "copywriting" and counted against the workspace cap. */
export async function runCopywriting(workspaceId: string, req: CopilotRequest) {
  const settings = await getAiSettings()
  if (!settings.anthropicKey) throw new CopywritingError('La IA no está configurada (falta la clave de Anthropic en IA · Plataforma)')
  const budget = await checkWorkspaceBudget(workspaceId)
  if (budget.state === 'blocked') throw new CopywritingError(`Tope mensual de IA alcanzado (${budget.pct}%)`)

  const ctx = await brandContext(workspaceId)
  let result
  try {
    result = await callClaude(
      {
        model: settings.defaultModel,
        system: [{ type: 'text', text: systemPrompt(ctx, req.tone), cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt(req) }],
        maxTokens: maxTokensFor(req),
        effort: req.action === 'hashtags' ? 'low' : 'medium',
      },
      { kind: 'copywriting', workspaceId },
    )
  } catch (err) {
    throw new CopywritingError(describeApiError(err))
  }
  if (result.message.stop_reason === 'refusal') throw new CopywritingError('El modelo no quiso redactar este contenido')
  const raw = textOf(result.message)
  const meta = { model: result.model, costUsd: result.costUsd }

  if (req.action === 'ideas') {
    const parsed = parseJson<{ ideas?: Array<{ title: string; angle?: string; format?: string }> }>(raw)
    if (!parsed?.ideas?.length) throw new CopywritingError('El modelo no devolvió ideas válidas; inténtalo de nuevo')
    return { ...meta, ideas: parsed.ideas.slice(0, 10) }
  }
  if (req.action === 'seo') {
    const p = parseJson<{ seoTitle?: string; seoDescription?: string; slug?: string; excerpt?: string; tags?: string[] }>(raw)
    if (!p) throw new CopywritingError('El modelo no devolvió datos SEO válidos; inténtalo de nuevo')
    return { ...meta, seo: { seoTitle: p.seoTitle?.slice(0, 120) ?? '', seoDescription: p.seoDescription?.slice(0, 300) ?? '', slug: slugify(p.slug || p.seoTitle || ''), excerpt: p.excerpt?.slice(0, 400) ?? '', tags: (p.tags || []).slice(0, 10).map(String) } }
  }
  if (req.action === 'images') {
    const p = parseJson<{ queries?: string[]; prompt?: string; alt?: string }>(raw)
    if (!p?.queries?.length && !p?.prompt) throw new CopywritingError('El modelo no devolvió sugerencias de imagen; inténtalo de nuevo')
    return { ...meta, images: { queries: (p.queries || []).map(String).map((q) => q.slice(0, 80)).slice(0, 5), prompt: (p.prompt || '').slice(0, 1000), alt: (p.alt || '').slice(0, 200) } }
  }
  if (req.action === 'hashtags') return { ...meta, hashtags: parseHashtags(raw) }
  const text = cleanText(raw)
  if (!text) throw new CopywritingError('El modelo no devolvió texto; inténtalo de nuevo')
  return { ...meta, text }
}
