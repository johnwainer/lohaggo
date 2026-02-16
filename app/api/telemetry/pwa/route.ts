import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { City, UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_EVENTS = new Set([
  'signup_completed',
  'login_completed',
  'install_prompt_shown',
  'install_prompt_dismissed',
  'install_clicked',
  'pwa_installed',
  'push_prompt_shown',
  'push_permission_granted',
  'push_permission_denied',
  'push_subscription_created',
  'push_subscription_removed',
])

function parseRole(value: unknown): UserRole | null {
  if (!value || typeof value !== 'string') return null
  if (value in UserRole) return value as UserRole
  return null
}

function parseCity(value: unknown): City | null {
  if (!value || typeof value !== 'string') return null
  if (value in City) return value as City
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const eventName = typeof body.eventName === 'string' ? body.eventName : null
    if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ error: 'Invalid eventName' }, { status: 400 })
    }

    const session = await getServerSession(authOptions)

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 120) : null
    const source = typeof body.source === 'string' ? body.source.slice(0, 120) : null
    const platform = typeof body.platform === 'string' ? body.platform.slice(0, 60) : null
    const browser = typeof body.browser === 'string' ? body.browser.slice(0, 60) : null

    const metadata = body.metadata && typeof body.metadata === 'object'
      ? JSON.stringify(body.metadata).slice(0, 6000)
      : null

    const role = parseRole(body.role) ?? (session?.user?.role ? parseRole(session.user.role) : null)

    await prisma.pwaTelemetryEvent.create({
      data: {
        userId: session?.user?.id ?? null,
        sessionId,
        eventName,
        role,
        city: parseCity(body.city),
        platform,
        browser,
        source,
        metadata,
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
