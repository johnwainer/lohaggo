import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canManage, getWorkspaceAccess } from '@/lib/workspaces'
import { checkConnectionToken, setSystemUserToken } from '@/lib/marketing/token-health'

type Ctx = { params: Promise<{ id: string }> }

/**
 * { action: 'check' }: verify (and renew if due) the account's token now.
 * { action: 'system_user', token }: switch the account to a permanent Business Manager system-user token.
 * Only the workspace owner or the superadmin.
 */
export async function POST(request: NextRequest, context: Ctx) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const conn = await prisma.channelConnection.findUnique({ where: { id } })
  if (!conn) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canManage(access, conn.workspaceId)) return NextResponse.json({ error: 'Solo el propietario del workspace puede cambiar el token' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  try {
    if (body.action === 'check') return NextResponse.json({ health: await checkConnectionToken(conn) })
    if (body.action === 'system_user') {
      const token = typeof body.token === 'string' ? body.token.trim() : ''
      if (token.length < 50) return NextResponse.json({ error: 'Pega el token completo del usuario del sistema' }, { status: 400 })
      const health = await setSystemUserToken(id, token)
      await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'channels.system_user_token', entityType: 'ChannelConnection', entityId: id, details: conn.name, request })
      return NextResponse.json({ health })
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo verificar el token' }, { status: 400 })
  }
  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
