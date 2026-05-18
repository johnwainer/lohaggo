import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const partner = await prisma.partnerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!partner) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const payouts = await prisma.payout.findMany({
    where: { partnerId: partner.id },
    include: {
      payment: {
        include: {
          booking: {
            include: {
              service: { select: { name: true, icon: true } },
              user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(payouts)
}
