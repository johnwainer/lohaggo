import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

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

  const { title, body, category, sortOrder } = await request.json()
  if (!title?.trim() || !body?.trim())
    return NextResponse.json({ error: 'Título y cuerpo requeridos' }, { status: 400 })

  const response = await prisma.cannedResponse.create({
    data: {
      title: title.trim(),
      body: body.trim(),
      category: category?.trim() || null,
      sortOrder: Number(sortOrder) || 0,
    },
  })

  return NextResponse.json({ response })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  await prisma.cannedResponse.update({ where: { id }, data: { isActive: false } })

  return NextResponse.json({ ok: true })
}
