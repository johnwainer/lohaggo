import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const entityType = searchParams.get('entityType')

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      // WhatsApp template sends are markers (thousands a day): only listed when asked for
      ...(action ? { action } : { NOT: { action: 'WA_TEMPLATE_SENT' } }),
      ...(entityType ? { entityType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ logs })
}
