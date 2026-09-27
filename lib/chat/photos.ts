/**
 * Photos a person sends over WhatsApp / Messenger / Instagram, taken to our own storage. Provider URLs
 * are not a place to keep them: Twilio's need the account's credentials and Meta's expire. Only images
 * go through (checked by content, not by the name), and each one lands in Cloudinary.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { cloudinaryService } from '@/lib/cloudinary'
import { validateUploadedFile } from '@/lib/file-validation'
import { fetchAttachmentForDocument } from '@/lib/partners/ops'
import { OpsError } from '@/lib/ops/origin'

const logger = createLogger('chat-photos')

export const CHAT_PHOTO_WINDOW_MS = 24 * 3600_000
export const MAX_CHAT_PHOTOS = 10

export type PhotoFolder = 'lohaggo/service-requests' | 'lohaggo/chat' | 'lohaggo/guarantee'

/** Images the person sent in this conversation recently, oldest first. */
export async function recentInboundPhotos(conversationId: string, opts: { since?: Date; take?: number } = {}) {
  const since = opts.since ?? new Date(Date.now() - CHAT_PHOTO_WINDOW_MS)
  const rows = await prisma.conversationMessage.findMany({
    where: { conversationId, direction: 'INBOUND', mediaUrl: { not: null }, mediaType: { startsWith: 'image' }, sentAt: { gte: since } },
    orderBy: { sentAt: 'desc' },
    take: opts.take ?? MAX_CHAT_PHOTOS,
    select: { id: true, mediaUrl: true, sentAt: true },
  })
  return rows.reverse().filter((r): r is typeof r & { mediaUrl: string } => Boolean(r.mediaUrl))
}

/** Downloads one chat photo from its provider and stores it. Throws OpsError when it is not a valid image. */
export async function storeChatPhoto(mediaUrl: string, folder: PhotoFolder): Promise<string> {
  const got = await fetchAttachmentForDocument(mediaUrl)
  if (!got.mime.startsWith('image/')) throw new OpsError('Solo se aceptan fotos (JPG, PNG o WebP)', 400)
  const file = new File([new Uint8Array(got.buffer)], got.name, { type: got.mime })
  const check = await validateUploadedFile(file)
  if (!check.ok) throw new OpsError(check.error, 400)
  const { url } = await cloudinaryService.upload(file, folder, 'image')
  return url
}

/** Stores several photos; the ones that fail are skipped (and counted) instead of losing the whole batch. */
export async function storeChatPhotos(mediaUrls: string[], folder: PhotoFolder): Promise<{ urls: string[]; failed: number }> {
  const urls: string[] = []
  let failed = 0
  for (const u of mediaUrls.slice(0, MAX_CHAT_PHOTOS)) {
    try {
      urls.push(await storeChatPhoto(u, folder))
    } catch (err) {
      failed++
      logger.warn('Chat photo not stored', { error: err instanceof Error ? err.message : String(err) })
    }
  }
  return { urls, failed }
}
