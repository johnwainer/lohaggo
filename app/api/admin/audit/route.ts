import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { CANDIDATE_ACTION } from '@/lib/marketing/library-core'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const entityType = searchParams.get('entityType')

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      // Markers, not admin actions (WhatsApp template sends, the resource library's AI candidates): only listed when asked for
      ...(action ? { action } : { action: { notIn: ['WA_TEMPLATE_SENT', CANDIDATE_ACTION] } }),
      ...(entityType ? { entityType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ logs })
}
