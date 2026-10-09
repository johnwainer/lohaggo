import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { marketingAuth } from '@/lib/marketing/permissions'
import { agentFor } from '@/lib/marketing/agent-views'
import { configOf } from '@/lib/marketing/agent'
import { generateImages, searchPexels, ImageError } from '@/lib/marketing/images'
import { servicePrompt } from '@/lib/marketing/images-core'
import { defaultImageStyleConfig, sanitizeImageStyles, styleById, IMAGE_STYLES } from '@/lib/marketing/image-styles'
import { cloudinaryService } from '@/lib/cloudinary'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const logger = createLogger('image-style-example')
type Ctx = { params: Promise<{ id: string }> }

/**
 * An example image for one style, so people can see what it looks like before letting the agent use it.
 * Generated with the workspace's image model (it costs one image); when AI is not available, a stock
 * photo that resembles the style. Saved in the agent's config.
 */
export async function POST(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const found = await agentFor(auth.access, (await context.params).id, 'marketing.edit')
  if ('response' in found) return found.response
  const agent = found.agent
  const body = await request.json().catch(() => ({}))
  const config = configOf(agent)
  const styles = config.images.styles ?? defaultImageStyleConfig()
  const style = styleById(styles, typeof body.styleId === 'string' ? body.styleId : null)
  if (!style) return NextResponse.json({ error: 'Estilo no encontrado' }, { status: 400 })

  const folderPost = `estilos-${agent.id}`
  let example: { url: string; source: 'ai' | 'pexels' } | null = null
  let aiError: string | null = null
  if (body.source !== 'pexels') {
    try {
      const [img] = await generateImages({ workspaceId: agent.workspaceId, postId: folderPost, prompt: servicePrompt('plomería'), style: style.prompt, orientation: 'square', n: 1 })
      if (img) example = { url: img.fullUrl, source: 'ai' }
    } catch (err) {
      aiError = err instanceof ImageError || err instanceof Error ? err.message : 'error'
    }
  }
  if (!example) {
    const query = IMAGE_STYLES.find((s) => s.id === style.id)?.exampleQuery
    if (query) {
      try {
        const { results } = await searchPexels(query, 'square', 1, 5)
        const pick = results[0]
        if (pick) {
          const up = await cloudinaryService.uploadRemote(pick.fullUrl, `marketing/${agent.workspaceId}/estilos`)
          example = { url: up.secure_url, source: 'pexels' }
        }
      } catch (err) {
        logger.warn('Stock example failed', { err: err instanceof Error ? err.message : err })
      }
    }
  }
  if (!example) return NextResponse.json({ error: aiError ? `No se pudo generar el ejemplo: ${aiError}` : 'No se pudo conseguir un ejemplo para este estilo' }, { status: 502 })

  // Re-read before writing: the config may have changed while the image was generated
  const fresh = await prisma.marketingAgent.findUnique({ where: { id: agent.id }, select: { config: true } })
  const cfg = (fresh?.config as Record<string, unknown> | null) ?? {}
  const images = (cfg.images as Record<string, unknown> | undefined) ?? {}
  const current = sanitizeImageStyles(images.styles, defaultImageStyleConfig())
  const next = { ...current, examples: { ...current.examples, [style.id]: { ...example, at: new Date().toISOString() } } }
  await prisma.marketingAgent.update({ where: { id: agent.id }, data: { config: { ...cfg, images: { ...images, styles: next } } as never } })
  return NextResponse.json({ example: next.examples[style.id], aiError: example.source === 'pexels' ? aiError : null })
}
