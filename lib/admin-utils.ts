import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.role !== 'ADMIN') {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true },
  })

  if (!user || user.role !== 'ADMIN') {
    return null
  }

  return user
}

export async function auditAdminAction(params: {
  actorId?: string | null
  actorEmail?: string | null
  action: string
  entityType: string
  entityId?: string | null
  route?: string | null
  details?: string | null
  request?: NextRequest
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        route: params.route ?? null,
        userAgent: params.request?.headers.get('user-agent') ?? null,
        ipAddress:
          params.request?.headers.get('x-forwarded-for') ||
          params.request?.headers.get('x-real-ip') ||
          null,
        details: params.details ?? null,
      },
    })
  } catch {
    // Do not block core admin operations when audit persistence fails.
  }
}

