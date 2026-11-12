import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { medianResponseMinutes, proposalWinRate } from '@/lib/partners/performance'

export const dynamic = 'force-dynamic'

const logger = createLogger('partner-performance')
const WINDOW_MS = 90 * 24 * 3600_000

/** The partner's own proposal results over the last 90 days: how many are chosen and how fast they answer. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'PARTNER') return NextResponse.json({ error: 'Solo partners pueden acceder' }, { status: 403 })

    const partner = await prisma.partnerProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    if (!partner) return NextResponse.json({ error: 'Perfil de partner no encontrado' }, { status: 404 })

    const rows = await prisma.proposal.findMany({
      where: { partnerId: partner.id, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
      select: { status: true, createdAt: true, serviceRequest: { select: { createdAt: true } } },
      take: 500,
    })

    const win = proposalWinRate(rows.map((r) => r.status))
    const responseMinutes = medianResponseMinutes(rows.map((r) => ({ requestAt: r.serviceRequest.createdAt, proposalAt: r.createdAt })))
    return NextResponse.json({ proposals: rows.length, winRate: win?.rate ?? null, won: win?.won ?? 0, decided: win?.decided ?? 0, responseMinutes })
  } catch (error) {
    logger.error('Error computing partner performance', error || undefined)
    return NextResponse.json({ error: 'No pudimos calcular tus resultados' }, { status: 500 })
  }
}
