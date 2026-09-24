import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan } from '@/lib/marketing/permissions'
import { COPILOT_ACTIONS, type CopilotRequest } from '@/lib/marketing/copilot-core'
import { CopywritingError, runCopywriting } from '@/lib/marketing/copilot'

export const maxDuration = 90

const CH = ['WEB', 'FACEBOOK', 'INSTAGRAM'] as const
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)

export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const b = await request.json().catch(() => ({}))
  const workspaceId = typeof b.workspaceId === 'string' ? b.workspaceId : ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })
  if (!COPILOT_ACTIONS.includes(b.action) || !CH.includes(b.channel)) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  const req: CopilotRequest = {
    action: b.action, channel: b.channel,
    brief: str(b.brief, 3000), text: str(b.text, 20000), instruction: str(b.instruction, 500), title: str(b.title, 200), tone: str(b.tone, 100),
    sourceChannel: CH.includes(b.sourceChannel) ? b.sourceChannel : undefined,
  }
  if (typeof b.postId === 'string') {
    const post = await prisma.marketingPost.findFirst({ where: { id: b.postId, workspaceId }, select: { campaign: { select: { name: true, objective: true, description: true } } } })
    req.campaign = post?.campaign ?? null
  }
  try {
    return NextResponse.json(await runCopywriting(workspaceId, req))
  } catch (err) {
    const message = err instanceof CopywritingError ? err.message : 'No se pudo generar el texto'
    return NextResponse.json({ error: message }, { status: err instanceof CopywritingError ? 409 : 500 })
  }
}
