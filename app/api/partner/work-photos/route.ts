import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cloudinaryService } from '@/lib/cloudinary'

export const runtime = 'nodejs'
export const maxDuration = 60

async function getPartnerIdForEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { partnerProfile: { select: { id: true } } },
  })
  return user?.partnerProfile?.id ?? null
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const partnerId = await getPartnerIdForEmail(session.user.email)
  if (!partnerId) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  const photos = await prisma.partnerWorkPhoto.findMany({
    where: { partnerId },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json({ photos })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const partnerId = await getPartnerIdForEmail(session.user.email)
  if (!partnerId) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const count = await prisma.partnerWorkPhoto.count({ where: { partnerId } })
  if (count >= 10) return NextResponse.json({ error: 'Máximo 10 fotos de trabajos' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('photo') as File | null
  const caption = formData.get('caption') as string | null

  if (!file) return NextResponse.json({ error: 'Foto requerida' }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Máximo 8MB por foto' }, { status: 400 })

  let url: string
  let publicId: string | undefined

  if (cloudinaryService.isEnabled()) {
    const result = await cloudinaryService.upload(file, 'lohaggo/work-photos')
    url = result.url
    publicId = result.publicId
  } else {
    return NextResponse.json({ error: 'Servicio de fotos no configurado' }, { status: 503 })
  }

  const maxOrder = await prisma.partnerWorkPhoto.aggregate({ where: { partnerId }, _max: { order: true } })
  const nextOrder = (maxOrder._max.order ?? -1) + 1

  const photo = await prisma.partnerWorkPhoto.create({
    data: { partnerId, url, publicId, caption: caption?.slice(0, 100) ?? null, order: nextOrder },
  })

  return NextResponse.json({ photo }, { status: 201 })
}
