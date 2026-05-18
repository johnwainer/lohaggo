import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cloudinaryService } from '@/lib/cloudinary'

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await context.params

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { partnerProfile: { select: { id: true } } },
  })
  const partnerId = user?.partnerProfile?.id
  if (!partnerId) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const photo = await prisma.partnerWorkPhoto.findUnique({ where: { id } })
  if (!photo || photo.partnerId !== partnerId) return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 })

  if (photo.publicId && cloudinaryService.isEnabled()) {
    await cloudinaryService.delete(photo.publicId).catch(() => null)
  }

  await prisma.partnerWorkPhoto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
