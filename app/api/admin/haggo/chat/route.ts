export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse, after } from 'next/server'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { ChatError, chatHistory, converse, maybeSummarize } from '@/lib/haggo/chat'

export async function GET(request: NextRequest) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const before = request.nextUrl.searchParams.get('before') ?? undefined
  return NextResponse.json({ messages: await chatHistory(60, before) }, { headers: { 'Cache-Control': 'no-store' } })
}

/** The superadmin writes; Haggo investigates with its read tools and answers. */
export async function POST(request: NextRequest) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  try {
    const result = await converse(auth.admin.id, body.text)
    after(maybeSummarize)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'No se pudo responder' }, { status: 500 })
  }
}
