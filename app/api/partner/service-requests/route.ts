import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { recordPromptContext } from '@/lib/pwa/adoption-strategy'
import { listOpenRequestsForPartner } from '@/lib/service-requests/ops'
import { toPartnerOpportunity } from '@/lib/partners/opportunities'

export const dynamic = 'force-dynamic'

const logger = createLogger('partner-service-requests')

/**
 * Opportunities for the partner: open requests in their cities/services (or addressed to them) plus the
 * still-open ones they already bid on. No client contact here: that is only exposed once a booking exists.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'PARTNER') {
      return NextResponse.json({ error: 'Solo partners pueden acceder' }, { status: 403 })
    }

    const partner = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, verified: true, isActive: true, user: { select: { isActive: true } } },
    })

    if (!partner) {
      return NextResponse.json({ error: 'Perfil de partner no encontrado' }, { status: 404 })
    }

    if (!partner.verified || !partner.isActive || !partner.user.isActive) {
      return NextResponse.json({ requests: [], requiresVerification: true })
    }

    const [open, alreadyProposed] = await Promise.all([
      listOpenRequestsForPartner(partner.id),
      prisma.serviceRequest.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
          proposals: { some: { partnerId: partner.id } },
        },
        include: {
          service: { include: { category: true } },
          user: { select: { name: true } },
          photos: true,
          proposals: { where: { partnerId: partner.id }, select: { id: true, price: true, notes: true, status: true, partnerId: true } },
          _count: { select: { proposals: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const seen = new Set<string>()
    const requests = [...open, ...alreadyProposed]
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => toPartnerOpportunity(r, partner.id))

    const hasRecentLead = open.some((item) => item.createdAt.getTime() >= Date.now() - 2 * 60 * 60 * 1000)
    if (hasRecentLead) {
      await recordPromptContext(session.user.id, 'PARTNER_LEAD_RECEIVED', {
        recentLeads: open.length,
      }).catch(() => undefined)
    }

    return NextResponse.json({ requests, requiresVerification: false })
  } catch (error) {
    logger.error('Error fetching service requests for partner:', error)
    return NextResponse.json(
      { error: 'Error al obtener las solicitudes' },
      { status: 500 }
    )
  }
}
