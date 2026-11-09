import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth } from '@/lib/marketing/permissions'
import { recolorSepiaImages } from '@/lib/marketing/recolor'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * { dryRun?: boolean (default true), limit?: number, workspaceId?: string } — new AI images with real colors
 * for the unpublished pieces whose image has the old sepia cast. Platform administrator only.
 */
export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  if (!auth.access.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  const dryRun = b.dryRun !== false
  const limit = Math.max(1, Math.min(8, Math.floor(Number(b.limit) || 4)))
  const workspaceId = typeof b.workspaceId === 'string' && b.workspaceId ? b.workspaceId : undefined
  const result = await recolorSepiaImages({ workspaceId, dryRun, limit })
  if (!dryRun) {
    await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_RECOLOR', entityType: 'MarketingMedia', entityId: workspaceId ?? 'all', details: JSON.stringify({ replaced: 'replaced' in result ? result.replaced : 0, left: 'left' in result ? result.left : null }), request })
  }
  return NextResponse.json(result)
}
