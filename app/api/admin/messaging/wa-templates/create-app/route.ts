import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'

const TEMPLATE_NAME = 'invitacion_app'
const TEMPLATE_LANGUAGE = 'es'
const TEMPLATE_BODY =
  'Hola {{1}} 👋\n\nTe invitamos a descargar la app de LoHaggo para gestionar tus solicitudes, ver tu agenda y atender a tus clientes desde el celular.\n\n📱 iPhone: {{2}}\n🤖 Android: {{3}}\n\n¡Descárgala gratis y lleva tu negocio a otro nivel! 🚀'

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const metaConf = runtimeConfig.metaWhatsApp.config as any

  if (!metaConf?.accessToken || !metaConf?.wabaId) {
    return NextResponse.json({ error: 'Meta WhatsApp no configurado' }, { status: 400 })
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
          body_text: [['Juan', 'https://apps.apple.com/app/lohaggo', 'https://play.google.com/store/apps/lohaggo']],
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
