import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { requireAdmin } from '@/lib/admin-utils'
import { getAiSettings } from '@/lib/ai/settings'
import { describeApiError } from '@/lib/ai/anthropic'
import { testVoyageKey } from '@/lib/ai/voyage'

/** "Probar conexión": uses the key typed in the form when given, otherwise the stored one. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin?.isSuperAdmin) return NextResponse.json({ error: 'Solo el administrador de la plataforma' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const settings = await getAiSettings(true)
  const typed = typeof body.key === 'string' && body.key.trim() ? body.key.trim() : null

  if (body.provider === 'voyage') {
    const key = typed || settings.voyageKey
    if (!key) return NextResponse.json({ ok: false, error: 'Sin clave de Voyage' })
    const model = typeof body.model === 'string' ? body.model : settings.embeddingModel
    return NextResponse.json(await testVoyageKey(key, model))
  }

  if (body.provider === 'openai') {
    const key = typed || settings.openaiKey
    if (!key) return NextResponse.json({ ok: false, error: 'Sin clave de OpenAI' })
    const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: 20_000 })
    const started = Date.now()
    try {
      const page = await client.models.list()
      return NextResponse.json({ ok: true, latencyMs: Date.now() - started, models: page.data.length })
    } catch (err) {
      return NextResponse.json({ ok: false, latencyMs: Date.now() - started, error: describeApiError(err) })
    }
  }

  const key = typed || settings.anthropicKey
  if (!key) return NextResponse.json({ ok: false, error: 'Sin clave de Anthropic' })
  const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 20_000 })
  const started = Date.now()
  try {
    const page = await client.models.list({ limit: 100 })
    return NextResponse.json({ ok: true, latencyMs: Date.now() - started, models: page.data.length })
  } catch (err) {
    return NextResponse.json({ ok: false, latencyMs: Date.now() - started, error: describeApiError(err) })
  }
}
