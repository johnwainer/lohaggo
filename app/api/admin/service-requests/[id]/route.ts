import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { requestCase } from '@/lib/admin/request-360'

export const dynamic = 'force-dynamic'

/** «Solicitud 360»: the whole request with its proposals, chats, booking, photos, payment and attention flags. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await context.params
  const c = await requestCase(id)
  if (!c) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  return NextResponse.json(c)
}
