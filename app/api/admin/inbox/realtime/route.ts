import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getWorkspaceAccess, listAccessibleWorkspaces } from '@/lib/workspaces'
import { inboxChannelName } from '@/lib/messaging/inbox-emitter'

export const dynamic = 'force-dynamic'

/** The Realtime channel names of the workspaces this admin can see (derived with a server secret). */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const workspaces = await listAccessibleWorkspaces(await getWorkspaceAccess(admin))
  return NextResponse.json({ channels: workspaces.map((w) => inboxChannelName(w.id)) }, { headers: { 'Cache-Control': 'no-store' } })
}
