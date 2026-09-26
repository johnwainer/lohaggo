import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'
import { editorialStats, getEditorialSettings, saveEditorialSettings } from '@/lib/marketing/editorial'
import { sanitizeEditorial } from '@/lib/marketing/editorial-rubric'
import { getAiSettings } from '@/lib/ai/settings'

export const dynamic = 'force-dynamic'

/** The workspace's review settings, the last 30 days and the platform models used by default. */
export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const workspaceId = request.nextUrl.searchParams.get('workspaceId') || ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.view')) return forbidden()
  const [settings, stats, ai] = await Promise.all([getEditorialSettings(workspaceId), editorialStats(workspaceId), getAiSettings()])
  return NextResponse.json({ settings, stats, defaults: { editorModel: ai.defaultModel, spellingModel: ai.fallbackModel }, canEdit: mkCan(auth.access, workspaceId, 'marketing.publish') })
}

export async function PUT(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const b = await request.json().catch(() => ({}))
  const workspaceId = typeof b.workspaceId === 'string' ? b.workspaceId : ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.publish')) return forbidden('Solo quien puede publicar cambia la revisión editorial')
  const prev = await getEditorialSettings(workspaceId)
  const next = sanitizeEditorial(b.settings, prev)
  await saveEditorialSettings(workspaceId, next, auth.admin.id)
  const changed = (Object.keys(next) as Array<keyof typeof next>).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(prev[k]))
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_EDITORIAL_SETTINGS', entityType: 'Workspace', entityId: workspaceId, details: changed.join(', ').slice(0, 500) || 'sin cambios', request })
  return NextResponse.json({ settings: next })
}
