import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createRateLimiter } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { dataRequestSchema, dueAtFor } from '@/lib/privacy/data-requests-core'

const logger = createLogger('data-requests')
export const dynamic = 'force-dynamic'

// 5 requests per hour per IP: a person files one, a bot files hundreds
const limiter = createRateLimiter({ windowMs: 60 * 60_000, max: 5, message: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde o escríbenos a hola@lohaggo.com.' })

async function handle(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = dataRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  // The honeypot answers like a success so a bot learns nothing
  if (parsed.data.honeypot?.trim()) return NextResponse.json({ ok: true })

  const { email, name, type, message } = parsed.data
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  // The same open request twice in a row is one request
  const duplicate = await prisma.dataRequest.findFirst({ where: { email, type, status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true, dueAt: true } })
  if (duplicate) return NextResponse.json({ ok: true, dueAt: duplicate.dueAt })

  const now = new Date()
  const row = await prisma.dataRequest.create({
    data: { email, name: name || null, type, message: message || null, userId: user?.id ?? null, dueAt: dueAtFor(now) },
    select: { id: true, dueAt: true },
  })
  logger.info('Data request received', { id: row.id, type })
  // The answer is the same whether the email has an account or not (no enumeration); the team verifies identity by email before acting
  return NextResponse.json({ ok: true, dueAt: row.dueAt })
}

export async function POST(request: NextRequest) {
  return limiter(request, handle)
}
