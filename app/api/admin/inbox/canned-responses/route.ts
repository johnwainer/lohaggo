import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

const MAX_TITLE = 80
const MAX_BODY = 2000
const MAX_CATEGORY = 40

function clean(raw: unknown, max: number) {
  return typeof raw === 'string' ? raw.trim().slice(0, max) : ''
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const responses = await prisma.cannedResponse.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
  })

  return NextResponse.json({ responses })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const title = clean(body.title, MAX_TITLE)
  const text = clean(body.body, MAX_BODY)
  if (!title || !text)
    return NextResponse.json({ error: 'Título y cuerpo requeridos' }, { status: 400 })

  const response = await prisma.cannedResponse.create({
    data: {
      title,
      body: text,
      category: clean(body.category, MAX_CATEGORY) || null,
      sortOrder: Number(body.sortOrder) || 0,
    },
  })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'INBOX_SAVED_REPLY_CREATE', entityType: 'CannedResponse', entityId: response.id, request })

  return NextResponse.json({ response })
}

/** { id, title?, body?, category? } — edits a saved reply. */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const data: { title?: string; body?: string; category?: string | null } = {}
  if (body.title !== undefined) data.title = clean(body.title, MAX_TITLE)
  if (body.body !== undefined) data.body = clean(body.body, MAX_BODY)
  if (body.category !== undefined) data.category = clean(body.category, MAX_CATEGORY) || null
  if (data.title === '' || data.body === '') return NextResponse.json({ error: 'Título y cuerpo requeridos' }, { status: 400 })

  const existing = await prisma.cannedResponse.findFirst({ where: { id, isActive: true }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Respuesta no encontrada' }, { status: 404 })
  const response = await prisma.cannedResponse.update({ where: { id }, data })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'INBOX_SAVED_REPLY_UPDATE', entityType: 'CannedResponse', entityId: id, request })

  return NextResponse.json({ response })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json().catch(() => ({}))
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const res = await prisma.cannedResponse.updateMany({ where: { id, isActive: true }, data: { isActive: false } })
  if (!res.count) return NextResponse.json({ error: 'Respuesta no encontrada' }, { status: 404 })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'INBOX_SAVED_REPLY_DELETE', entityType: 'CannedResponse', entityId: id, request })

  return NextResponse.json({ ok: true })
}
