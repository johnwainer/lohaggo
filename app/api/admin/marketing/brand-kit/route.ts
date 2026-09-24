import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'
import { LOGO_POSITIONS } from '@/lib/marketing/images-core'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const workspaceId = request.nextUrl.searchParams.get('workspaceId') || ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.view')) return forbidden()
  const kit = await prisma.marketingBrandKit.findUnique({ where: { workspaceId } })
  return NextResponse.json({ kit, canEdit: mkCan(auth.access, workspaceId, 'marketing.publish') })
}

/** Position, size, opacity, margin and whether new images get the logo by default. */
export async function PUT(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const b = await request.json().catch(() => ({}))
  const workspaceId = typeof b.workspaceId === 'string' ? b.workspaceId : ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.publish')) return forbidden('Solo quien puede publicar cambia el kit de marca')
  const data: Record<string, unknown> = {}
  if (typeof b.logoPosition === 'string' && b.logoPosition in LOGO_POSITIONS) data.logoPosition = b.logoPosition
  if (b.logoScale !== undefined) data.logoScale = Math.min(0.5, Math.max(0.05, Number(b.logoScale) || 0.18))
  if (b.logoOpacity !== undefined) data.logoOpacity = Math.min(100, Math.max(10, Math.round(Number(b.logoOpacity) || 90)))
  if (b.logoMargin !== undefined) data.logoMargin = Math.min(200, Math.max(0, Math.round(Number(b.logoMargin) || 0)))
  if (typeof b.autoApply === 'boolean') data.autoApply = b.autoApply
  if (b.removeLogo === true) Object.assign(data, { logoUrl: null, logoPublicId: null })
  const kit = await prisma.marketingBrandKit.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data })
  return NextResponse.json({ kit })
}
