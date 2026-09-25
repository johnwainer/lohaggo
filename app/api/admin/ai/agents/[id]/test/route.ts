import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { aiAuth, can, forbidden } from '@/lib/ai/route-auth'
import { AgentRuntimeService } from '@/lib/ai/runtime'
import { getAiSettings, hasTextProvider } from '@/lib/ai/settings'
import { formatForChannel } from '@/lib/ai/format'

export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Playground: the same preHandoff + reply as production (same buildSystem, tools, loop, markers and
 * channel formatting). Tools that write run dry; reads are real. Costs money: permission ai.test.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const agent = await prisma.aiAgent.findUnique({ where: { id } })
  if (!agent || !can(auth, agent.workspaceId, 'ai.view')) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!can(auth, agent.workspaceId, 'ai.test')) return forbidden('Probar agentes consume saldo: necesitas el permiso "Probar agentes"')

  const settings = await getAiSettings()
  if (!hasTextProvider(settings)) return NextResponse.json({ error: 'Falta la clave de Anthropic u OpenAI (IA · Plataforma)' }, { status: 409 })

  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 4000) : ''
  if (!text) return NextResponse.json({ error: 'Escribe un mensaje' }, { status: 400 })
  const channel = ['WHATSAPP', 'SMS', 'MESSENGER', 'INSTAGRAM'].includes(body.channel) ? body.channel : 'WHATSAPP'
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m: { role?: string; content?: unknown }) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-agent.memoryWindow)
    .map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content.slice(0, 4000) }))
  while (history.length && history[0].role === 'assistant') history.shift()

  const ws = await prisma.workspace.findUnique({ where: { id: agent.workspaceId }, select: { timezone: true } })
  const turns = history.filter((h: { role: string }) => h.role === 'assistant').length
  const pre = AgentRuntimeService.preHandoff(agent, { text, turns, now: new Date(), accountTz: ws?.timezone || 'America/Bogota' })
  if (pre.action !== 'continue') {
    const reply = pre.action === 'notice' ? formatForChannel(pre.message, channel) : pre.action === 'handoff' ? agent.handoffMessage : ''
    return NextResponse.json({ result: { ok: true, preHandoff: pre, text: reply, handoff: pre.action === 'handoff', handoffReason: pre.action === 'handoff' ? pre.reason : null, costUsd: 0, model: null, toolsUsed: [], chunks: [], usage: null } })
  }

  const result = await AgentRuntimeService.reply({
    agent,
    workspaceId: agent.workspaceId,
    channel,
    conversationId: null,
    userId: null,
    contact: { name: typeof body.contactName === 'string' ? body.contactName.slice(0, 80) : 'Cliente de prueba', phone: null, tags: [], fields: {} },
    history,
    text,
    summary: null,
    kind: 'playground',
    dryRun: true,
  })
  return NextResponse.json({ result: { ...result, preHandoff: null } })
}
