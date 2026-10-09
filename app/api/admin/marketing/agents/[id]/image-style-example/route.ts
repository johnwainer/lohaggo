import { NextRequest, NextResponse } from 'next/server'
import { marketingAuth } from '@/lib/marketing/permissions'
import { agentFor } from '@/lib/marketing/agent-views'
import { configOf } from '@/lib/marketing/agent'
import { defaultImageStyleConfig, styleById } from '@/lib/marketing/image-styles'
import { makeStyleExample, saveStyleExample } from '@/lib/marketing/image-style-examples'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Ctx = { params: Promise<{ id: string }> }

/**
 * An example image for one style, so people can see what it looks like before letting the agent use it.
 * Generated with the workspace's image model (it costs one image); when AI is not available, a stock
 * photo that resembles the style (photographic styles only). `{ clear: true }` removes the example.
 */
export async function POST(request: NextRequest, context: Ctx) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const found = await agentFor(auth.access, (await context.params).id, 'marketing.edit')
  if ('response' in found) return found.response
  const agent = found.agent
  const body = await request.json().catch(() => ({}))
  const style = styleById(configOf(agent).images.styles ?? defaultImageStyleConfig(), typeof body.styleId === 'string' ? body.styleId : null)
  if (!style) return NextResponse.json({ error: 'Estilo no encontrado (si es propio, guarda el agente primero)' }, { status: 400 })

  if (body.clear === true) {
    await saveStyleExample(agent.id, style.id, null)
    return NextResponse.json({ cleared: style.id })
  }

  const r = await makeStyleExample(agent, style.id)
  if (!r.example) return NextResponse.json({ error: `No se pudo mostrar este estilo: ${r.aiError ?? 'sin imagen'}` }, { status: 502 })
  const saved = await saveStyleExample(agent.id, style.id, r.example)
  return NextResponse.json({ example: saved.examples[style.id], aiError: r.example.source === 'pexels' ? r.aiError : null })
}
