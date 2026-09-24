import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { aiCan, getAiAccess, type AiAccess, type AiPermission } from '@/lib/ai/permissions'

type Admin = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>

export type AiAuth = { ok: true; admin: Admin; access: AiAccess } | { ok: false; response: NextResponse }

export async function aiAuth(): Promise<AiAuth> {
  const admin = await requireAdmin()
  if (!admin) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { ok: true, admin, access: await getAiAccess(admin) }
}

export function forbidden(message = 'No tienes permiso para esta acción') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function can(auth: Extract<AiAuth, { ok: true }>, workspaceId: string, perm: AiPermission) {
  return aiCan(auth.access, workspaceId, perm)
}
