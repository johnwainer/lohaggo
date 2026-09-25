import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireHaggoAdmin } from '@/lib/haggo/auth'

const STATUSES = ['seen', 'resolved', 'dismissed', 'new']

/** The superadmin marks a finding as seen, resolved or dismissed (or reopens it). */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  const res = await prisma.haggoFinding.updateMany({ where: { id }, data: { status: body.status } })
  if (!res.count) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
