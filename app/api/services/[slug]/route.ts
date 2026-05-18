import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createLogger } from '@/lib/logger'
import { generatePartnerSlug } from '@/lib/slug'

export const dynamic = 'force-dynamic'


const logger = createLogger('services-slug')

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const citySlug = searchParams.get('city') || 'medellin'

  try {
    // Obtener la ciudad desde la DB para convertir slug a enum
    const cityRecord = await prisma.cityConfig.findUnique({
      where: { slug: citySlug }
    })

    if (!cityRecord) {
      return NextResponse.json(
        { error: "Ciudad no válida" },
        { status: 400 }
      )
    }

    // Normalizar nombre de ciudad a formato enum
    const cityEnum = cityRecord.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, '_')

    const service = await prisma.service.findUnique({
      where: { slug },
      include: {
        category: true,
        partners: {
          where: {
            active: true,
            partner: {
              city: cityEnum as any,
              isActive: true,
              verified: true,
              isAvailable: true,
            }
          },
          include: {
            partner: {
              include: {
                user: {
                  select: {
                    name: true,
                    phone: true,
                    image: true,
                  }
                },
                documents: {
                  where: { status: 'APPROVED' },
                  select: { type: true, status: true }
                }
              }
            }
          }
        }
      }
    })

    if (!service) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      )
    }

    // Auto-generate slugs for partners that don't have one yet
    const partnersWithoutSlug = service.partners.filter(ps => !ps.partner.slug)
    if (partnersWithoutSlug.length > 0) {
      await Promise.all(
        partnersWithoutSlug.map(async ps => {
          const user = await prisma.user.findUnique({ where: { id: ps.partner.userId }, select: { name: true } })
          const base = generatePartnerSlug(user?.name ?? 'socio', ps.partner.city)
          let candidate = base
          let attempt = 0
          while (true) {
            const exists = await prisma.partnerProfile.findUnique({ where: { slug: candidate } })
            if (!exists || exists.id === ps.partner.id) break
            attempt++
            candidate = `${base}-${attempt}`
          }
          const updated = await prisma.partnerProfile.update({ where: { id: ps.partner.id }, data: { slug: candidate } })
          ps.partner.slug = updated.slug
        })
      )
    }

    return NextResponse.json({
      ...service,
      partners: service.partners,
    })
  } catch (error) {
    logger.error('Error fetching servicio:', error || undefined)
    return NextResponse.json(
      { error: "Error al obtener servicio" },
      { status: 500 }
    )
  }
}
