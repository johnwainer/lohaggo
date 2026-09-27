import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publicWhatsappPhone } from '@/lib/public/trust'
import { waHref, withRef } from '@/lib/public/whatsapp'

export const dynamic = 'force-dynamic'

/**
 * Short link that opens our WhatsApp with a prefilled message tagged `(ref: post-<id>)` / `(ref: ad-<code>)`,
 * for places where a wa.me link with its text is too long (a Facebook post, a printed flyer). The chat, and
 * any request it ends in, is credited to that piece in Analítica → Origen.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ ref: string }> }) {
  const { ref: raw } = await context.params
  const ref = raw.toLowerCase()
  const home = new URL('/', request.nextUrl.origin)
  if (!/^(post|ad|web|blog)-[a-z0-9][a-z0-9_-]{0,80}$/.test(ref)) return NextResponse.redirect(home)
  const phone = await publicWhatsappPhone()
  if (!phone) return NextResponse.redirect(home)
  let service: string | null = null
  if (ref.startsWith('post-')) {
    const post = await prisma.marketingPost.findUnique({ where: { id: ref.slice(5) }, select: { agentMeta: true } }).catch(() => null)
    const s = (post?.agentMeta as { service?: unknown } | null)?.service
    service = typeof s === 'string' && s.trim() ? s.trim().slice(0, 60) : null
  }
  const lead = ref.startsWith('ad-') ? 'vi su anuncio' : 'vi su publicación'
  const text = withRef(`Hola, ${lead} y ${service ? `quiero pedir ${service.toLowerCase()}` : 'necesito un servicio'}`, ref)
  return NextResponse.redirect(waHref(phone, text), 302)
}
