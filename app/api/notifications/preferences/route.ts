import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getNotificationAutomationSnapshot, isNotificationChannelEnabled, type NotificationChannelKey } from '@/lib/notifications/automation-config'
import { getUserNotificationChannelState, setUserNotificationChannelPreference } from '@/lib/notifications/user-preferences'

const VALID_CHANNELS: NotificationChannelKey[] = ['PUSH', 'EMAIL', 'WHATSAPP', 'SMS']

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const state = await getUserNotificationChannelState(user.id)
  if (!state) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  return NextResponse.json(state)
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const channel = body?.channel as NotificationChannelKey | undefined
  const enabled = body?.enabled

  if (!channel || !VALID_CHANNELS.includes(channel) || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const snapshot = await getNotificationAutomationSnapshot()
  const enabledByAdmin = isNotificationChannelEnabled({ snapshot, role: user.role, channel })
  if (!enabledByAdmin) {
    return NextResponse.json(
      { error: 'Este canal está desactivado por administración y no puede modificarse.' },
      { status: 403 }
    )
  }

  await setUserNotificationChannelPreference(user.id, channel, enabled)
  const state = await getUserNotificationChannelState(user.id)
  return NextResponse.json({ ok: true, ...state })
}
