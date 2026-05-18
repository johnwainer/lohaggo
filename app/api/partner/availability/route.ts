import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  if (typeof body.isAvailable !== 'boolean') {
    return NextResponse.json({ error: 'isAvailable requerido' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { partnerProfile: { select: { id: true } } },
  })

  if (!user?.partnerProfile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const updated = await prisma.partnerProfile.update({
    where: { id: user.partnerProfile.id },
    data: { isAvailable: body.isAvailable },
    select: { isAvailable: true },
  })

  return NextResponse.json({ isAvailable: updated.isAvailable })
}
