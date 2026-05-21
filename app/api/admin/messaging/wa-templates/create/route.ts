import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'

const TEMPLATE_NAME = 'lanzamiento_ciudad'
const TEMPLATE_LANGUAGE = 'es'
const TEMPLATE_BODY =
  'Hola, te escribimos del equipo LoHaggo 👋\n\nQueremos contarte que la plataforma en *{{1}}* entra en operación el *{{2}}*. A partir de esa fecha comenzarás a recibir solicitudes de clientes directamente.\n\nGracias por tu paciencia. ¡Estamos listos para arrancar juntos! 🚀'

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const metaConf = runtimeConfig.metaWhatsApp.config as any

  if (!metaConf?.accessToken || !metaConf?.wabaId) {
    return NextResponse.json({ error: 'Meta WhatsApp not configured' }, { status: 400 })
  }

  const payload = {
    name: TEMPLATE_NAME,
    language: TEMPLATE_LANGUAGE,
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: TEMPLATE_BODY,
        example: {
          body_text: [['Medellín', '1 de junio de 2026']],
        },
      },
    ],
  }

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${metaConf.wabaId}/message_templates`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${metaConf.accessToken}`,
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: 'Meta API error', details: data }, { status: res.status })
  }

  return NextResponse.json({ ok: true, template: data })
}
