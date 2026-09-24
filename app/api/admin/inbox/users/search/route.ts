import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { toE164 } from '@/lib/inbox/contacts'

/** Platform users (clients and partners) to link to an inbox contact, by name, email or phone. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 80)
  if (q.length < 3) return NextResponse.json({ users: [] })
  const phone = toE164(q)
  const digits = q.replace(/\D/g, '')
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['CLIENT', 'PARTNER'] },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        ...(phone ? [{ phone }] : []),
        ...(digits.length >= 6 ? [{ phone: { contains: digits } }] : []),
      ],
    },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, partnerProfile: { select: { verified: true, city: true } } },
    orderBy: { name: 'asc' },
    take: 8,
  })
  return NextResponse.json({ users })
}
