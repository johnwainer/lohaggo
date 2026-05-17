import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() || ''
  const role = request.nextUrl.searchParams.get('role') // PARTNER | CLIENT | undefined

  const where: any = {
    phone: { not: null },
    isActive: true,
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      partnerProfile: {
        select: {
          city: true,
          verified: true,
          services: {
            take: 1,
            select: { service: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
    take: 50,
  })

  const contacts = users.map((u) => {
    const service = u.partnerProfile?.services?.[0]?.service?.name ?? null
    const city = u.partnerProfile?.city ?? null
    return {
      id: u.id,
      name: u.name,
      phone: u.phone!,
      email: u.email,
      role: u.role,
      city,
      service,
      verified: u.partnerProfile?.verified ?? null,
      // Pre-built variable map for quick template fill
      fields: {
        nombre: u.name,
        telefono: u.phone!,
        email: u.email,
        ciudad: city ?? '',
        servicio: service ?? '',
      },
    }
  })

  return NextResponse.json({ contacts })
}
