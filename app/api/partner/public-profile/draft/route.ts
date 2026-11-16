import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimitResponse } from '@/lib/rate-limit-route'
import { draftPartnerBio } from '@/lib/partners/bio'
import { cityLabel, NOTES_MAX } from '@/lib/partners/bio-core'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Propone un titular y una biografía con los datos del socio. No guarda nada: el socio lo revisa y lo guarda él. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'PARTNER') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const limited = await rateLimitResponse([{ key: `partner-bio:${session.user.id}`, windowMs: 3600_000, max: 6 }], 'Ya generaste varias propuestas. Intenta de nuevo en un rato o escribe tu texto a mano.')
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const notes = typeof body?.notes === 'string' ? body.notes.slice(0, NOTES_MAX) : ''

  const partner = await prisma.partnerProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      city: true, rating: true, totalReviews: true, completedServicesCount: true, verified: true, isCompany: true, companyName: true,
      user: { select: { name: true } },
      services: { where: { active: true }, select: { service: { select: { name: true } } }, take: 8 },
    },
  })
  if (!partner) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const draft = await draftPartnerBio({
    firstName: (partner.user?.name ?? '').trim().split(/\s+/)[0] ?? '',
    city: cityLabel(String(partner.city)),
    services: partner.services.map((s) => s.service.name),
    completed: partner.completedServicesCount,
    rating: partner.rating,
    reviews: partner.totalReviews,
    verified: partner.verified,
    company: partner.isCompany ? partner.companyName : null,
    notes,
  })
  return NextResponse.json(draft)
}
