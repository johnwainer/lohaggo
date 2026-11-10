/**
 * Image understanding for the inbox agent: downloads the photos of the current turn (Twilio with the
 * account's credentials, Meta's signed CDN URLs, our own storage) so the model sees them, and keeps the
 * one-line description the model wrote of each one (ConversationEvent «image_described») for later turns.
 * A photo that does not download or is not a usable image stays a «📷 Imagen» placeholder: logged, never
 * an error for the person.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { getInboxSettings } from '@/lib/inbox/settings'
import { fetchChannelMedia } from '@/lib/messaging/media-fetch'
import {
  IMAGE_DESCRIBED_EVENT,
  checkDownloadedImage,
  descriptionMap,
  encodeDescription,
  selectTurnImages,
  type VisionImage,
} from '@/lib/ai/vision-core'

const logger = createLogger('ai-vision')
const DOWNLOAD_TIMEOUT_MS = 15_000

export type TurnImages = {
  images: VisionImage[]
  /** Photos of the turn the model will not see (vision off, over the limit, failed download) */
  unseen: number
}

/** Inbound messages since the last message the contact saw from us (the turn being answered). */
async function turnMessages(conversationId: string) {
  const lastOut = await prisma.conversationMessage.findFirst({
    where: { conversationId, direction: 'OUTBOUND', isInternal: false },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  })
  return prisma.conversationMessage.findMany({
    where: { conversationId, direction: 'INBOUND', ...(lastOut ? { sentAt: { gt: lastOut.sentAt } } : {}) },
    orderBy: { sentAt: 'asc' },
    take: 20,
    select: { id: true, direction: true, body: true, mediaUrl: true, mediaType: true },
  })
}

async function downloadImage(url: string): Promise<{ mime: string; data: string }> {
  const { buffer } = await fetchChannelMedia(url, { maxBytes: 8 * 1024 * 1024, timeoutMs: DOWNLOAD_TIMEOUT_MS, label: 'imagen' })
  const check = checkDownloadedImage(buffer)
  if (!check.ok) throw new Error(check.reason)
  return { mime: check.mime, data: buffer.toString('base64') }
}

/** The photos of this turn the agent gets to see, per the inbox settings (vision on, up to maxImages). */
export async function loadTurnImages(conversationId: string, channel: string): Promise<TurnImages> {
  const turn = await turnMessages(conversationId)
  const photos = turn.filter((m) => m.mediaUrl && (m.mediaType ?? '').toLowerCase().startsWith('image'))
  if (!photos.length) return { images: [], unseen: 0 }
  const settings = await getInboxSettings()
  if (!settings.vision.enabled) return { images: [], unseen: photos.length }
  const selected = selectTurnImages(turn, { maxImages: settings.vision.maxImages, channel })
  const results = await Promise.all(selected.map(async (m) => {
    try {
      return { messageId: m.id, ...(await downloadImage(m.mediaUrl!)) }
    } catch (err) {
      logger.warn('Image not shown to the agent', { conversationId, messageId: m.id, reason: (err instanceof Error ? err.message : String(err)).slice(0, 200) })
      return null
    }
  }))
  const images = results.filter((r): r is VisionImage => Boolean(r))
  return { images, unseen: photos.length - images.length }
}

/** Stores the model's description of each photo it saw (one event per photo). */
export async function saveImageDescriptions(conversationId: string, items: Array<{ messageId: string; description: string }>, agent: { id: string; name: string }) {
  if (!items.length) return
  await prisma.conversationEvent.createMany({
    data: items.map((i) => ({ conversationId, type: IMAGE_DESCRIBED_EVENT, actorType: 'ai', actorId: agent.id, actorName: agent.name, detail: encodeDescription(i.messageId, i.description) })),
  }).catch((err) => logger.warn('Image descriptions not saved', { conversationId, err: err instanceof Error ? err.message : err }))
}

/** Descriptions of the photos among these messages, by message id. Never fails (no descriptions instead). */
export async function loadImageDescriptions(conversationId: string, messageIds: string[]): Promise<Map<string, string>> {
  if (!messageIds.length) return new Map()
  const rows = await prisma.conversationEvent.findMany({
    where: { conversationId, type: IMAGE_DESCRIBED_EVENT, OR: messageIds.map((id) => ({ detail: { startsWith: `${id}::` } })) },
    orderBy: { createdAt: 'asc' },
    select: { detail: true },
  }).catch(() => [])
  return descriptionMap(rows.map((r) => r.detail))
}
