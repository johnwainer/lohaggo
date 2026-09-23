export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { cloudinaryService } from '@/lib/cloudinary'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { uploadInboxDocument } from '@/lib/messaging/attachment-storage'
import { channelSupportsAttachment, cloudinaryResourceType, safeAttachmentName, validateInboxAttachment } from '@/lib/messaging/attachments'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const conversation = await prisma.conversation.findUnique({ where: { id }, select: { workspaceId: true, channel: true } })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const validation = await validateInboxAttachment(file)
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

  const support = channelSupportsAttachment(conversation.channel, validation.mime, validation.kind)
  if (!support.ok) return NextResponse.json({ error: support.error }, { status: 400 })

  try {
    const safeName = safeAttachmentName(file.name, validation.mime)

    // Documents → Supabase Storage (Cloudinary denies PDF delivery on this account)
    if (validation.kind === 'file') {
      const stored = await uploadInboxDocument({ buffer: validation.buffer, mime: validation.mime, name: safeName, workspaceId: conversation.workspaceId })
      return NextResponse.json({
        ok: true,
        attachment: { url: stored.url, mediaType: validation.mime, mediaName: safeName, kind: validation.kind, size: file.size },
      })
    }

    if (!cloudinaryService.isEnabled()) {
      return NextResponse.json({ error: 'Almacenamiento de medios (Cloudinary) no configurado' }, { status: 500 })
    }
    const upload = await cloudinaryService.upload(
      new File([new Uint8Array(validation.buffer) as unknown as BlobPart], safeName, { type: validation.mime }),
      `lohaggo/inbox/${conversation.workspaceId}`,
      cloudinaryResourceType(validation.kind)
    )
    return NextResponse.json({
      ok: true,
      attachment: { url: upload.url, mediaType: validation.mime, mediaName: safeName, kind: validation.kind, size: file.size },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'No se pudo subir el archivo' }, { status: 502 })
  }
}
