/**
 * Ad agent: writes a paid package for Meta Ads (strategy, audience, copy variants, AI images with the brand
 * logo) that a person copies into Meta Ads Manager. It never touches Meta: there is no ads permission yet.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { callClaude, describeApiError, type CallResult } from '@/lib/ai/anthropic'
import { checkWorkspaceBudget } from '@/lib/ai/limits'
import { getAiSettings, hasTextProvider } from '@/lib/ai/settings'
import { SITE_URL } from '@/lib/marketing/seo'
import { checkGuardrails, type GuardrailIssue } from '@/lib/marketing/agent-core'
import { defaultAgentConfig, normalizeDomain, readAgentConfig, type AgentConfig } from '@/lib/marketing/agent-input'
import { brandName, catalogFor } from '@/lib/marketing/agent-data'
import { reviewContextFor } from '@/lib/marketing/agent'
import { DEFAULT_EDITORIAL } from '@/lib/marketing/editorial-rubric'
import { generateImages, getBrandKit, getImageSettings, providerReady } from '@/lib/marketing/images'
import { brandedUrl } from '@/lib/marketing/images-core'
import { AD_FORMATS, parseAdPackage, type AdFormat, type AdInput, type AdPackage } from '@/lib/marketing/ads-core'
import { AD_TOOL, adSystem, adTask } from '@/lib/marketing/ads-prompt'

const logger = createLogger('marketing-ads')

/** Packages per workspace and 24 h, whatever the monthly cap says (each one may generate several images). */
export const DAILY_AD_DRAFTS = 20
/** Packages being written at the same time per workspace. */
const MAX_GENERATING = 2
const STUCK_MS = 10 * 60_000
const CALL_TIMEOUT_MS = 150_000

export class AdError extends Error {}

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

export type AdImage = { url: string; originalUrl: string; publicId: string | null; format: AdFormat; ratio: string; prompt: string; alt: string; purpose: string }

async function contextFor(workspaceId: string, campaignId: string | null) {
  const agent = campaignId ? await prisma.marketingAgent.findUnique({ where: { campaignId }, include: { campaign: true } }) : null
  if (agent && agent.workspaceId === workspaceId) {
    const ctx = await reviewContextFor(agent, DEFAULT_EDITORIAL)
    return { ...ctx, config: readAgentConfig(agent.config) }
  }
  const config = defaultAgentConfig()
  const [brand, catalog] = await Promise.all([brandName(workspaceId), catalogFor(config)])
  const context = [
    `Catálogo de servicios (nombre · precio base en COP):\n${catalog.services.map((x) => `- ${x.name}${x.basePrice ? ` · desde $${Math.round(x.basePrice).toLocaleString('es-CO')}` : ''}`).join('\n') || '- (sin datos)'}`,
    `Ciudades: ${catalog.cities.join(', ') || 'sin datos'}`,
    'Propuesta de valor: profesionales verificados para el hogar, pago seguro en la app.',
  ].join('\n\n')
  return { brand: brand || 'la marca', treatment: 'tú' as const, context, protectedWords: [], config }
}

function guardIssues(pkg: AdPackage, config: AgentConfig, prices: number[]): GuardrailIssue[] {
  const own = [normalizeDomain(SITE_URL) || 'lohaggo.com']
  const res = checkGuardrails(
    pkg.variants.map((v) => ({ channel: 'FACEBOOK' as const, text: `${v.primaryText}\n${v.headline}\n${v.description}` })),
    {
      now: new Date(), promos: config.offer.promos,
      allowedTexts: [...config.offer.facts, config.offer.priceNotes, config.offer.valueProp, ...config.offer.differentiators],
      prices, bannedWords: config.voice.bannedWords, bannedTopics: config.voice.bannedTopics, ownDomains: own, allowedDomains: config.offer.allowedDomains,
    },
  )
  return res.issues
}

/** Why the workspace cannot create a package now, or null. */
export async function adBlock(workspaceId: string) {
  const ai = await getAiSettings()
  if (!hasTextProvider(ai)) return 'La IA no está configurada (IA · Plataforma)'
  const ws = await checkWorkspaceBudget(workspaceId)
  if (ws.state === 'blocked') return `Tope mensual de IA del workspace alcanzado (${ws.pct} %)`
  const today = await prisma.marketingAdDraft.count({ where: { workspaceId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } })
  if (today >= DAILY_AD_DRAFTS) return `Límite diario alcanzado (${DAILY_AD_DRAFTS} pautas en 24 h)`
  return null
}

/**
 * Writes the package and its images. The row exists from the start («generating») so a slow run is visible;
 * it ends «ready» (images that failed are reported, the copy is still usable) or «failed».
 */
export async function createAdDraft(workspaceId: string, input: AdInput, userId: string | null) {
  const why = await adBlock(workspaceId)
  if (why) throw new AdError(why)
  // The service and the city go into the model's instructions: only names of the catalog, never free text
  if (input.service || input.city) {
    const catalog = await catalogFor(defaultAgentConfig())
    const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    if (input.service) {
      const svc = catalog.services.find((x) => norm(x.name) === norm(input.service!))
      if (!svc) throw new AdError(`«${input.service}» no es un servicio del catálogo`)
      input = { ...input, service: svc.name }
    }
    if (input.city) {
      const city = catalog.cities.find((x) => norm(x) === norm(input.city!))
      if (!city) throw new AdError(`«${input.city}» no es una ciudad donde opera la plataforma`)
      input = { ...input, city }
    }
  }
  // Count and create under a per-workspace lock: parallel requests cannot all pass the daily cap
  const draft = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${`ad-drafts:${workspaceId}`}))) AS l`
    const since = new Date(Date.now() - 24 * 3600_000)
    const [today, running] = await Promise.all([
      tx.marketingAdDraft.count({ where: { workspaceId, createdAt: { gte: since } } }),
      tx.marketingAdDraft.count({ where: { workspaceId, status: 'generating', createdAt: { gte: new Date(Date.now() - STUCK_MS) } } }),
    ])
    if (today >= DAILY_AD_DRAFTS) throw new AdError(`Límite diario alcanzado (${DAILY_AD_DRAFTS} pautas en 24 h)`)
    if (running >= MAX_GENERATING) throw new AdError('Ya se están creando otras pautas en este workspace; espera a que terminen')
    return tx.marketingAdDraft.create({
      data: { workspaceId, campaignId: input.campaignId, title: input.service ? `Pauta: ${input.service}` : 'Pauta nueva', status: 'generating', input: json(input), createdById: userId },
    })
  })
  let cost = 0
  let model: string | null = null
  try {
    const ctx = await contextFor(workspaceId, input.campaignId)
    const ai = await getAiSettings()
    const link = `${SITE_URL}/`
    const system = adSystem({ brand: ctx.brand, treatment: ctx.treatment, context: ctx.context })
    const call = async (task: string) => {
      let r: CallResult
      try {
        r = await callClaude(
          { model: ai.defaultModel, system: [{ type: 'text', text: system }], messages: [{ role: 'user', content: task }], tools: [AD_TOOL], maxTokens: 7000, effort: 'medium', timeoutMs: CALL_TIMEOUT_MS },
          { kind: 'marketing_ad_agent', workspaceId },
        )
      } catch (err) {
        throw new AdError(describeApiError(err))
      }
      cost += r.costUsd
      model = r.model
      if (r.message.stop_reason === 'refusal') throw new AdError('El modelo no quiso hacer esta pauta')
      const block = r.message.content.find((b) => b.type === 'tool_use' && b.name === AD_TOOL.name)
      if (!block || block.type !== 'tool_use') throw new AdError(r.message.stop_reason === 'max_tokens' ? 'La respuesta salió demasiado larga; pide menos variantes' : 'El agente no entregó la pauta en el formato pedido')
      return block.input
    }
    const task = adTask(input, link)
    let parsed = parseAdPackage(await call(task), input)
    if (!parsed.ok) parsed = parseAdPackage(await call(`${task}\n\nTu respuesta anterior no sirvió; corrige esto: ${parsed.errors.join(' · ')}`), input)
    if (!parsed.ok) throw new AdError(parsed.errors.join(' · '))
    const pkg = parsed.value
    const catalog = await catalogFor(ctx.config)
    const issues = guardIssues(pkg, ctx.config, catalog.prices)
    await prisma.marketingAdDraft.update({ where: { id: draft.id }, data: { title: pkg.title.slice(0, 120), output: json(pkg), issues: json(issues), costUsd: cost, model } })

    const { images, errors, imageCost } = await makeImages(workspaceId, draft.id, pkg, input.formats)
    cost += imageCost
    const done = await prisma.marketingAdDraft.update({
      where: { id: draft.id },
      data: { status: 'ready', images: json(images), costUsd: cost, error: errors.length ? `Imágenes: ${errors.slice(0, 3).join(' · ')}`.slice(0, 1000) : null },
    })
    return done
  } catch (err) {
    const message = err instanceof AdError ? err.message : describeApiError(err)
    logger.warn('Ad draft failed', { draftId: draft.id, message })
    return prisma.marketingAdDraft.update({ where: { id: draft.id }, data: { status: 'failed', error: message.slice(0, 1000), costUsd: cost, model } })
  }
}

/** One AI image per plan and format, with the brand logo laid over when the workspace has one. */
async function makeImages(workspaceId: string, draftId: string, pkg: AdPackage, formats: AdFormat[]) {
  const images: AdImage[] = []
  const errors: string[] = []
  if (!pkg.images.length) return { images, errors, imageCost: 0 }
  const settings = await getImageSettings()
  const ready = providerReady(settings)
  if (!ready.ready) return { images, errors: [`${ready.reason} (Publicaciones → Ajustes → Marca e imágenes)`], imageCost: 0 }
  const kit = await getBrandKit(workspaceId)
  let generated = 0
  const jobs = pkg.images.flatMap((plan) => formats.map((format) => ({ plan, format })))
  // A few at a time: the providers throttle, and a slow image must not hold the others
  for (let i = 0; i < jobs.length; i += 3) {
    const batch = await Promise.allSettled(jobs.slice(i, i + 3).map(async ({ plan, format }) => {
      const [img] = await generateImages({ workspaceId, postId: `pauta/${draftId}`, prompt: plan.prompt, orientation: format, n: 1 })
      generated++
      const branded = kit?.logoPublicId ? brandedUrl(img.fullUrl, kit) : null
      return { url: branded || img.fullUrl, originalUrl: img.fullUrl, publicId: img.publicId ?? null, format, ratio: AD_FORMATS[format].label, prompt: plan.prompt, alt: plan.alt, purpose: plan.purpose } satisfies AdImage
    }))
    for (const r of batch) {
      if (r.status === 'fulfilled') images.push(r.value)
      else errors.push(r.reason instanceof Error ? r.reason.message : 'No se pudo generar')
    }
  }
  return { images, errors: Array.from(new Set(errors)), imageCost: generated * settings.costPerImageUsd }
}

export async function listAdDrafts(workspaceIds: string[] | null) {
  // A run that died (timeout, deploy) never finishes: after a while it shows as failed instead of «creando»
  await prisma.marketingAdDraft.updateMany({
    where: { ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}), status: 'generating', createdAt: { lt: new Date(Date.now() - STUCK_MS) } },
    data: { status: 'failed', error: 'Se interrumpió mientras se creaba; créala de nuevo' },
  })
  return prisma.marketingAdDraft.findMany({
    where: { ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}), status: { not: 'archived' } },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })
}
