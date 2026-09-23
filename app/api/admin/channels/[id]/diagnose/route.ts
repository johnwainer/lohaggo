export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { runCapabilityDiagnostics } from '@/lib/messaging/meta-channels'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  try {
    const capabilities = await runCapabilityDiagnostics(id)
    if (!capabilities) return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true, capabilities })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error en el diagnóstico' }, { status: 500 })
  }
}
