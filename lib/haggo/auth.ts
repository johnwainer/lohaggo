import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'

/** Haggo belongs to the platform superadmin: everyone else gets a 403. */
export async function requireHaggoAdmin() {
  const admin = await requireAdmin()
  if (!admin) return { ok: false as const, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  if (!admin.isSuperAdmin) return { ok: false as const, response: NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 }) }
  return { ok: true as const, admin }
}
