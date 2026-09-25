import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { forceProviderDown, resetProvider } from '@/lib/ai/providers/state'
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers/types'

const SIMULATED_DOWN_MINUTES = 5

/**
 * «Forzar reintento» clears a provider's down state; «Simular caída» (tests only) marks it down for
 * 5 minutes so the next calls go to the other provider. Platform superadmin only.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const provider = body.provider as ProviderId
  if (!PROVIDERS.includes(provider)) return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
  if (body.action === 'reset') await resetProvider(provider)
  else if (body.action === 'simulate_down') await forceProviderDown(provider, SIMULATED_DOWN_MINUTES, admin.email)
  else return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  await auditAdminAction({
    actorId: admin.id, actorEmail: admin.email, action: body.action === 'reset' ? 'AI_PROVIDER_RESET' : 'AI_PROVIDER_SIMULATE_DOWN',
    entityType: 'AiProviderState', entityId: provider, details: JSON.stringify({ provider }), request,
  })
  return NextResponse.json({ ok: true })
}
