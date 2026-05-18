import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePartnerSlug, normalizeSlug } from '@/lib/slug'

async function getPartner(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { partnerProfile: { include: { workPhotos: { orderBy: { order: 'asc' } } } } },
  })
  return user?.partnerProfile ?? null
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const partner = await getPartner(session.user.email)
  if (!partner) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  return NextResponse.json({ partner })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const partner = await getPartner(session.user.email)
  if (!partner) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.profileHeadline !== undefined) updates.profileHeadline = String(body.profileHeadline).slice(0, 120) || null
  if (body.bio !== undefined) updates.bio = String(body.bio).slice(0, 800) || null
  if (typeof body.isPublicProfile === 'boolean') updates.isPublicProfile = body.isPublicProfile

  if (body.slug !== undefined) {
    const desiredSlug = normalizeSlug(String(body.slug))
    if (!desiredSlug || desiredSlug.length < 3) {
      return NextResponse.json({ error: 'El slug debe tener al menos 3 caracteres' }, { status: 400 })
    }
    const existing = await prisma.partnerProfile.findUnique({ where: { slug: desiredSlug } })
    if (existing && existing.id !== partner.id) {
      return NextResponse.json({ error: 'Esa URL ya está en uso, intenta con otra' }, { status: 409 })
    }
    updates.slug = desiredSlug
  }

  // Auto-generate slug on first save if not set
  if (!partner.slug && !updates.slug) {
    const user = await prisma.user.findUnique({ where: { id: partner.userId }, select: { name: true } })
    const autoSlug = generatePartnerSlug(user?.name ?? 'socio', partner.city)
    const unique = await ensureUniqueSlug(autoSlug, partner.id)
    updates.slug = unique
  }

  const updated = await prisma.partnerProfile.update({ where: { id: partner.id }, data: updates })
  return NextResponse.json({ partner: updated })
}

async function ensureUniqueSlug(base: string, excludeId: string): Promise<string> {
  let candidate = base
  let attempt = 0
  while (true) {
    const existing = await prisma.partnerProfile.findUnique({ where: { slug: candidate } })
    if (!existing || existing.id === excludeId) return candidate
    attempt += 1
    candidate = `${base}-${attempt}`
  }
}
