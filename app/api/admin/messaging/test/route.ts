import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { sendMessageViaProvider } from '@/lib/messaging/providers'

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { channel, to, message } = body

  if (!channel || !to) {
    return NextResponse.json({ error: 'channel y to son requeridos' }, { status: 400 })
  }

  if (!['SMS', 'WHATSAPP'].includes(channel)) {
    return NextResponse.json({ error: 'channel debe ser SMS o WHATSAPP' }, { status: 400 })
  }

  const runtimeConfig = await getMessagingProviderRuntimeConfig()

  const result = await sendMessageViaProvider(
    {
      channel,
      to,
      body: message || `✅ Mensaje de prueba desde LoHaggo Admin — ${new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })}`,
    },
    runtimeConfig
  )

  return NextResponse.json(result)
}
