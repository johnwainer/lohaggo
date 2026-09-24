import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cloudinaryService } from '@/lib/cloudinary'
import { marketingAuth, mkCan } from '@/lib/marketing/permissions'
import { ORIENTATIONS, clampCount, isPexelsImageUrl, type Orientation } from '@/lib/marketing/images-core'
import { ImageError, generateImages, importImage, searchPexels } from '@/lib/marketing/images'
import { CopywritingError, runCopywriting } from '@/lib/marketing/copilot'
import { loadPostDetail, mediaFolder, reopenReviewIfNeeded } from '@/lib/marketing/service'

export const maxDuration = 180

const CH = ['WEB', 'FACEBOOK', 'INSTAGRAM'] as const

/**
 * Image suggestions for a post.
 * suggest: Claude reads the post and proposes photo searches + an AI prompt (editable before sending).
 * search: Pexels. generate: the configured AI provider. import: add the chosen one to the post.
 */
export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const b = await request.json().catch(() => ({}))
  const post = typeof b.postId === 'string' ? await prisma.marketingPost.findUnique({ where: { id: b.postId }, select: { id: true, workspaceId: true, title: true, status: true } }) : null
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (post.status === 'publishing') return NextResponse.json({ error: 'No se puede cambiar mientras se publica' }, { status: 409 })
  const orientation: Orientation = ORIENTATIONS.includes(b.orientation) ? b.orientation : 'landscape'

  try {
    if (b.action === 'suggest') {
      const channel = CH.includes(b.channel) ? b.channel : 'INSTAGRAM'
      const r = await runCopywriting(post.workspaceId, { action: 'images', channel, title: post.title, text: typeof b.text === 'string' ? b.text.slice(0, 6000) : '', brief: typeof b.brief === 'string' ? b.brief.slice(0, 2000) : '' })
      return NextResponse.json(r)
    }
    if (b.action === 'search') {
      const query = typeof b.query === 'string' ? b.query.trim() : ''
      if (!query) return NextResponse.json({ error: 'Escribe qué buscar' }, { status: 400 })
      return NextResponse.json(await searchPexels(query, orientation, Number(b.page) || 1, 12))
    }
    if (b.action === 'generate') {
      const prompt = typeof b.prompt === 'string' ? b.prompt.trim().slice(0, 1500) : ''
      if (prompt.length < 10) return NextResponse.json({ error: 'Describe la imagen (al menos una frase)' }, { status: 400 })
      let referenceUrl: string | null = null
      if (typeof b.referenceMediaId === 'string') {
        const ref = await prisma.marketingMedia.findFirst({ where: { id: b.referenceMediaId, postId: post.id, kind: 'image' }, select: { url: true, originalUrl: true } })
        referenceUrl = ref ? ref.originalUrl || ref.url : null
      }
      const results = await generateImages({ workspaceId: post.workspaceId, postId: post.id, prompt, style: typeof b.style === 'string' ? b.style.slice(0, 200) : null, orientation, n: clampCount(b.count), referenceUrl })
      return NextResponse.json({ results })
    }
    if (b.action === 'import') {
      const c = b.candidate || {}
      const source = c.source === 'ai' ? 'ai' : c.source === 'pexels' ? 'pexels' : null
      const url = typeof c.fullUrl === 'string' ? c.fullUrl : ''
      if (source === 'pexels' && !isPexelsImageUrl(url)) return NextResponse.json({ error: 'Imagen de Pexels inválida' }, { status: 400 })
      if (source === 'ai') {
        // Generated images live in this post's folder of our account; nothing else is accepted
        const folder = `${mediaFolder(post.workspaceId, post.id)}/ia/`
        const cloud = cloudinaryService.cloudName()
        // The URL must be exactly the asset named by that public id (no other file of the account)
        const escaped = typeof c.publicId === 'string' ? c.publicId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
        const exact = new RegExp(`^https://res\\.cloudinary\\.com/${cloud}/image/upload/(v\\d+/)?${escaped}\\.[a-z0-9]+$`)
        if (!cloud || typeof c.publicId !== 'string' || !c.publicId.startsWith(folder) || !/^[\w/-]+$/.test(c.publicId) || !exact.test(url)) {
          return NextResponse.json({ error: 'Imagen generada inválida' }, { status: 400 })
        }
      }
      if (!source) return NextResponse.json({ error: 'Origen inválido' }, { status: 400 })
      await importImage({
        workspaceId: post.workspaceId, postId: post.id, brand: b.brand === true,
        candidate: { source, url, publicId: c.publicId ?? null, width: c.width ?? null, height: c.height ?? null, bytes: c.bytes ?? null, alt: typeof b.alt === 'string' ? b.alt : c.alt, credit: c.credit, creditUrl: c.creditUrl },
      })
      await reopenReviewIfNeeded(post.id, mkCan(auth.access, post.workspaceId, 'marketing.publish'))
      return NextResponse.json({ post: await loadPostDetail(post.id) })
    }
  } catch (err) {
    const known = err instanceof ImageError || err instanceof CopywritingError
    return NextResponse.json({ error: known ? err.message : err instanceof Error ? err.message : 'Error con las imágenes' }, { status: known ? 409 : 502 })
  }
  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
