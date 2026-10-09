/**
 * Example images of the image styles, saved in the agent's config: generated with the workspace's image
 * model, or (for photographic styles, when AI is not available) a stock photo that resembles the style.
 */
import { prisma } from '@/lib/prisma'
import { cloudinaryService } from '@/lib/cloudinary'
import { createLogger } from '@/lib/logger'
import { generateImages, getImageSettings, providerReady, searchPexels } from '@/lib/marketing/images'
import { servicePrompt } from '@/lib/marketing/images-core'
import { IMAGE_STYLES, defaultImageStyleConfig, sanitizeImageStyles, styleById, usableStyles, type ImageStyleConfig } from '@/lib/marketing/image-styles'

const logger = createLogger('image-style-examples')

type Example = ImageStyleConfig['examples'][string]

async function readStyles(agentId: string) {
  const fresh = await prisma.marketingAgent.findUnique({ where: { id: agentId }, select: { config: true } })
  const cfg = (fresh?.config as Record<string, unknown> | null) ?? {}
  const images = (cfg.images as Record<string, unknown> | undefined) ?? {}
  return { cfg, images, styles: sanitizeImageStyles(images.styles, defaultImageStyleConfig()) }
}

/** Saves (or with null, removes) the example of one style; re-reads the config so concurrent edits are kept */
export async function saveStyleExample(agentId: string, styleId: string, example: Example | null) {
  const { cfg, images, styles } = await readStyles(agentId)
  const { [styleId]: _old, ...rest } = styles.examples
  const next = { ...styles, examples: example ? { ...rest, [styleId]: example } : rest }
  await prisma.marketingAgent.update({ where: { id: agentId }, data: { config: { ...cfg, images: { ...images, styles: next } } as never } })
  return next
}

/** One example for a style: AI first (unless `stockOnly`), then a stock photo when the style allows it */
export async function makeStyleExample(agent: { id: string; workspaceId: string }, styleId: string, opts: { aiOnly?: boolean; stockOnly?: boolean } = {}): Promise<{ example: Example | null; aiError: string | null }> {
  const { styles } = await readStyles(agent.id)
  const style = styleById(styles, styleId)
  if (!style) return { example: null, aiError: 'Estilo no encontrado' }
  let aiError: string | null = null
  if (!opts.stockOnly) {
    try {
      const [img] = await generateImages({ workspaceId: agent.workspaceId, postId: `estilos-${agent.id}`, prompt: servicePrompt('plomería'), style: style.prompt, orientation: 'square', n: 1 })
      if (img) return { example: { url: img.fullUrl, source: 'ai', at: new Date().toISOString() }, aiError: null }
    } catch (err) {
      aiError = err instanceof Error ? err.message : 'error'
    }
  }
  if (opts.aiOnly) return { example: null, aiError }
  const query = IMAGE_STYLES.find((s) => s.id === style.id)?.exampleQuery
  if (!query) return { example: null, aiError: aiError ?? 'Este estilo solo se puede mostrar con la IA' }
  try {
    const { results } = await searchPexels(query, 'square', 1, 8)
    // A different photo each time someone asks for another example
    const pick = results[Math.floor(Math.random() * Math.min(results.length, 5))]
    if (pick) {
      const up = await cloudinaryService.uploadRemote(pick.fullUrl, `marketing/${agent.workspaceId}/estilos`)
      return { example: { url: up.secure_url, source: 'pexels', at: new Date().toISOString() }, aiError }
    }
  } catch (err) {
    logger.warn('Stock example failed', { err: err instanceof Error ? err.message : err })
  }
  return { example: null, aiError }
}

/**
 * Called by the agent's cycle: when the image AI works, the first usable style without an AI example
 * gets one (one image per cycle, so the cost stays small). Returns what it did, or null.
 */
export async function upgradeOneStyleExample(agent: { id: string; workspaceId: string }): Promise<string | null> {
  const s = await getImageSettings()
  if (!providerReady(s).ready) return null
  const { styles } = await readStyles(agent.id)
  const target = usableStyles(styles).find((x) => styles.examples[x.id]?.source !== 'ai')
  if (!target) return null
  const r = await makeStyleExample(agent, target.id, { aiOnly: true })
  if (!r.example) return `ejemplo de «${target.label}»: ${r.aiError ?? 'sin imagen'}`
  await saveStyleExample(agent.id, target.id, r.example)
  return `ejemplo de «${target.label}» generado con IA`
}
