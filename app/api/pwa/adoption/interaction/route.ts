import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { markPromptInteraction } from '@/lib/pwa/adoption-strategy'

const VALID_ACTIONS = new Set(['shown', 'dismissed', 'install_clicked', 'push_clicked'])
const VALID_STAGES = new Set(['INSTALL', 'PUSH'])

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const action = body?.action
  const stage = body?.stage

  if (!VALID_ACTIONS.has(action) || !VALID_STAGES.has(stage)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await markPromptInteraction(session.user.id, action, stage)
  return NextResponse.json({ ok: true })
}
