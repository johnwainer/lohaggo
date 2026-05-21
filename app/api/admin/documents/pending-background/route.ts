import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/errors'

const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''

    // Partners with at least one approved identity doc
    const identityVerified = await prisma.verificationDocument.findMany({
      where: { type: { in: IDENTITY_TYPES as any }, status: 'APPROVED' },
      select: { partnerId: true },
      distinct: ['partnerId'],
    })
    const identityVerifiedIds = identityVerified.map(d => d.partnerId)

    // Among those, exclude partners who already have an approved or pending ANTECEDENTES doc
    const hasBackground = await prisma.verificationDocument.findMany({
      where: {
        partnerId: { in: identityVerifiedIds },
        type: 'ANTECEDENTES' as any,
        status: { in: ['APPROVED', 'PENDING'] },
      },
      select: { partnerId: true },
      distinct: ['partnerId'],
    })
    const hasBackgroundIds = new Set(hasBackground.map(d => d.partnerId))

    const pendingIds = identityVerifiedIds.filter(id => !hasBackgroundIds.has(id))

    const partners = await prisma.partnerProfile.findMany({
      where: {
        id: { in: pendingIds },
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        isActive: true,
        verified: true,
        user: { select: { name: true, email: true, image: true } },
        services: { select: { service: { select: { name: true } } }, take: 1 },
      },
      orderBy: { user: { name: 'asc' } },
    })

    return NextResponse.json({ partners, total: partners.length })
  } catch (error) {
    return handleApiError(error, 'admin-documents-pending-background')
  }
}
