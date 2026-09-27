import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setAvailability } from '@/lib/partners/ops'
import { APP_ORIGIN, OpsError } from '@/lib/ops/origin'

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.isAvailable !== 'boolean') return NextResponse.json({ error: 'isAvailable requerido' }, { status: 400 })

  try {
    await setAvailability({ userId: session.user.id, role: 'PARTNER', email: session.user.email ?? null }, body.isAvailable, APP_ORIGIN)
    return NextResponse.json({ isAvailable: body.isAvailable })
  } catch (error) {
    if (error instanceof OpsError) return NextResponse.json({ error: error.status === 403 ? 'Perfil no encontrado' : error.message }, { status: error.status === 403 ? 404 : error.status })
    return NextResponse.json({ error: 'Error al actualizar disponibilidad' }, { status: 500 })
  }
}
