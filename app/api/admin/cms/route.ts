import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entries = await prisma.cmsEntry.findMany({ orderBy: { updatedAt: 'desc' } })
  return NextResponse.json({ entries })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.key || !body?.title) {
    return NextResponse.json({ error: 'key y title requeridos' }, { status: 400 })
  }

  const entry = await prisma.cmsEntry.create({
    data: {
      key: body.key,
      title: body.title,
      content: body.content || '{}',
      status: body.status || 'DRAFT',
      updatedBy: admin.email,
      publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'cms.create',
    entityType: 'CmsEntry',
    entityId: entry.id,
    route: '/api/admin/cms',
    details: entry.key,
    request,
  })

  return NextResponse.json({ entry }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const status = body.status
  const entry = await prisma.cmsEntry.update({
    where: { id: body.id },
    data: {
      title: body.title,
      content: body.content,
      status,
      updatedBy: admin.email,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'cms.update',
    entityType: 'CmsEntry',
    entityId: entry.id,
    route: '/api/admin/cms',
    details: entry.key,
    request,
  })

  return NextResponse.json({ entry })
}
