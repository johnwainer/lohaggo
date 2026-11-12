import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { listDuplicateAccounts } from '@/lib/fraud/signals'

export const dynamic = 'force-dynamic'

/** Superadmin, read-only: probable duplicate client accounts (same phone, or same name created within 1 h via chat) for manual merge review. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo el superadmin' }, { status: 403 })
  const groups = await listDuplicateAccounts()
  return NextResponse.json({ groups: groups.slice(0, 200), total: groups.length })
}
