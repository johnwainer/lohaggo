import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'
import { preflightPost } from '@/lib/marketing/preflight'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Ctx = { params: Promise<{ id: string }> }

/** «Probar con Meta»: Meta checks each Facebook / Instagram version without publishing anything. */
export async function POST(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const post = await prisma.marketingPost.findUnique({ where: { id }, select: { workspaceId: true, title: true } })
  if (!post || !mkCan(auth.access, post.workspaceId, 'marketing.view')) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (!mkCan(auth.access, post.workspaceId, 'marketing.publish')) return forbidden('No tienes permiso para publicar')
  try {
    const results = await preflightPost(id, { maxWaitMs: 120_000 })
    await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_POST_PREFLIGHT', entityType: 'MarketingPost', entityId: id, details: results.map((r) => `${r.channel}/${r.format}: ${r.status}`).join(', ').slice(0, 500), request })
    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo probar' }, { status: 400 })
  }
}
