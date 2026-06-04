import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const excluded = Boolean(body?.excluded)

  const user = await prisma.user.update({
    where: { id },
    data: {
      excludedFromMarketing: excluded,
      excludedFromMarketingAt: excluded ? new Date() : null,
      excludedFromMarketingBy: excluded ? admin.email : null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      excludedFromMarketing: true,
      excludedFromMarketingAt: true,
      excludedFromMarketingBy: true,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: excluded ? 'user.marketing_exclusion.add' : 'user.marketing_exclusion.remove',
    entityType: 'User',
    entityId: user.id,
    route: `/api/admin/users/${id}/marketing-exclusion`,
    details: `${user.email} excluded=${excluded}`,
    request,
  })

  return NextResponse.json({ user })
}
