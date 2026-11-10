import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { runPartnerReactivation } from '@/lib/partners/reactivation'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const logger = createLogger('admin-partner-reactivation-run')

/**
 * «Enviar ahora»: runs the campaign at once with the same window, limits and stop rules as the hourly cron
 * (two runs never overlap inside the same half hour). Superadmin only.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo el superadmin' }, { status: 403 })
  try {
    const result = await runPartnerReactivation()
    await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'PARTNER_REACTIVATION_RUN', entityType: 'PartnerReactivationSettings', details: JSON.stringify(result).slice(0, 2000), request })
    return NextResponse.json({ result })
  } catch (err) {
    logger.error('Manual reactivation run failed', { err: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'No se pudo ejecutar la campaña' }, { status: 500 })
  }
}
