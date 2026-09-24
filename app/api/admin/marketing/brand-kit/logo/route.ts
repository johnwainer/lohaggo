import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cloudinaryService } from '@/lib/cloudinary'
import { marketingAuth, mkCan, forbidden } from '@/lib/marketing/permissions'

const MAX = 3 * 1024 * 1024

/** Logo upload (PNG with transparency recommended; SVG is not accepted). */
export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const form = await request.formData().catch(() => null)
  const workspaceId = String(form?.get('workspaceId') || '')
  const file = form?.get('file')
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.publish')) return forbidden('Solo quien puede publicar cambia el kit de marca')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) return NextResponse.json({ error: 'El logo debe ser PNG (ideal, con fondo transparente), WebP o JPG' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'El logo pesa más de 3 MB' }, { status: 400 })
  if (!cloudinaryService.isEnabled()) return NextResponse.json({ error: 'Cloudinary no está configurado' }, { status: 500 })
  const up = await cloudinaryService.upload(file, `lohaggo/marketing/${workspaceId}/marca`, 'image')
  const kit = await prisma.marketingBrandKit.upsert({
    where: { workspaceId },
    create: { workspaceId, logoUrl: up.url, logoPublicId: up.publicId },
    update: { logoUrl: up.url, logoPublicId: up.publicId },
  })
  return NextResponse.json({ kit })
}
