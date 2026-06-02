import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'

const LANGUAGE = 'es_CO'

type TemplateDef = {
  friendly_name: string
  body: string
  variables: Record<string, string>
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
}

const TEMPLATES: TemplateDef[] = [
  {
    friendly_name: 'pago_confirmado_cliente',
    body:
      '✅ *LoHaggo*\n\nHola {{1}}, el socio {{3}} confirmó la recepción del pago por el servicio de *{{2}}*.\n\nVer reserva: {{4}}',
    variables: { '1': 'María', '2': 'Plomería', '3': 'Carlos', '4': 'https://lohaggo.com/dashboard?tab=bookings' },
    category: 'UTILITY',
  },
  {
    friendly_name: 'pago_rechazado_cliente',
    body:
      '⚠️ *LoHaggo*\n\nHola {{1}}, el socio rechazó el reporte de pago del servicio de *{{2}}*.\n\nMotivo: {{3}}\n\nReportar de nuevo: {{4}}',
    variables: { '1': 'María', '2': 'Plomería', '3': 'Monto no coincide', '4': 'https://lohaggo.com/dashboard?tab=bookings' },
    category: 'UTILITY',
  },
  {
    friendly_name: 'calificacion_recibida',
    body:
      '⭐ *LoHaggo*\n\nHola {{1}}, {{2}} te calificó con {{3}} estrellas por el servicio de *{{4}}*.\n\nVer calificación: {{5}}',
    variables: { '1': 'Carlos', '2': 'María', '3': '5', '4': 'Plomería', '5': 'https://lohaggo.com/partner?tab=bookings' },
    category: 'UTILITY',
  },
  {
    friendly_name: 'recordatorio_calificacion',
    body:
      '⭐ *LoHaggo*\n\nHola {{1}}, tu opinión ayuda a la comunidad. No olvides calificar el servicio de *{{2}}*.\n\nCalificar ahora: {{3}}',
    variables: { '1': 'María', '2': 'Plomería', '3': 'https://lohaggo.com/dashboard?tab=bookings' },
    category: 'UTILITY',
  },
  {
    friendly_name: 'solicitud_por_expirar',
    body:
      '⏰ *LoHaggo*\n\nHola {{1}}, tu solicitud de *{{2}}* expira pronto y aún no has aceptado ninguna propuesta.\n\nVer propuestas: {{3}}',
    variables: { '1': 'María', '2': 'Plomería', '3': 'https://lohaggo.com/dashboard?tab=requests' },
    category: 'UTILITY',
  },
  {
    friendly_name: 'recordatorio_servicio_manana',
    body:
      '📅 *LoHaggo*\n\nHola {{1}}, mañana tienes el servicio de *{{2}}* a las {{3}}.\n\nVer detalles: {{4}}',
    variables: { '1': 'María', '2': 'Plomería', '3': '10:00 AM', '4': 'https://lohaggo.com/dashboard?tab=bookings' },
    category: 'UTILITY',
  },
  {
    friendly_name: 'servicio_empieza_pronto',
    body:
      '⏳ *LoHaggo*\n\nHola {{1}}, tu servicio de *{{2}}* empieza a las {{3}}.\n\nVer detalles: {{4}}',
    variables: { '1': 'María', '2': 'Plomería', '3': '10:00 AM', '4': 'https://lohaggo.com/dashboard?tab=bookings' },
    category: 'UTILITY',
  },
  {
    friendly_name: 'pago_pendiente_recordatorio',
    body:
      '💰 *LoHaggo*\n\nHola {{1}}, el cliente {{2}} aún no ha reportado el pago del servicio de *{{3}}*. Puedes recordarle por chat.\n\nVer reserva: {{4}}',
    variables: { '1': 'Carlos', '2': 'María', '3': 'Plomería', '4': 'https://lohaggo.com/partner?tab=bookings' },
    category: 'UTILITY',
  },
]

async function createOne(t: TemplateDef, accountSid: string, authToken: string) {
  const auth = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`

  const createRes = await fetch('https://content.twilio.com/v1/Content', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      friendly_name: t.friendly_name,
      language: LANGUAGE,
      variables: t.variables,
      types: { 'twilio/text': { body: t.body } },
    }),
  })
  const createData = await createRes.json()
  if (!createRes.ok) {
    return { name: t.friendly_name, ok: false, error: createData }
  }
  const sid: string = createData.sid

  const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${sid}/ApprovalRequests/whatsapp`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: t.friendly_name, category: t.category }),
  })
  const approvalData = await approvalRes.json()

  return {
    name: t.friendly_name,
    ok: true,
    sid,
    approvalStatus: approvalRes.ok ? approvalData?.status ?? 'submitted' : approvalData,
  }
}

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const twilio = runtimeConfig.twilio.config
  if (!twilio?.accountSid || !twilio?.authToken) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  const results = []
  for (const t of TEMPLATES) {
    const r = await createOne(t, twilio.accountSid, twilio.authToken)
    results.push(r)
  }

  const summary: Record<string, string> = {}
  for (const r of results) {
    if (r.ok && r.sid) summary[r.name] = r.sid
  }

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    results,
    waTemplateSidsSnippet: summary,
  })
}
