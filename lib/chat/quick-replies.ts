/**
 * One-tap phrases for the chat, per side. They fill the box (the person still taps «Enviar»), and none of
 * them carries a phone, link or payment detail, so the contact guard never blocks them.
 */
import { PHOTO_ONLY_TEXT } from '@/lib/chat/constants'

export type ChatSide = 'CLIENT' | 'PARTNER'

export const QUICK_REPLIES: Record<ChatSide, readonly string[]> = {
  PARTNER: ['Voy en camino', 'Ya llegué', '¿Me envías una foto?', '¿Me confirmas la dirección?'],
  CLIENT: ['¿A qué hora llegas?', 'Te espero', 'Te envío una foto', '¿Me confirmas el precio?'],
}

export function quickRepliesFor(role: string | null | undefined): readonly string[] {
  return role === 'PARTNER' ? QUICK_REPLIES.PARTNER : QUICK_REPLIES.CLIENT
}

/** What the messages route stores when only a photo is sent. */
export function messageTextFor(text: string, hasPhoto: boolean): string {
  const t = text.trim()
  return t || (hasPhoto ? PHOTO_ONLY_TEXT : '')
}

/** Only real images up to 10 MB go up (the upload route's limit); everything else is explained inline. */
export function photoProblem(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return 'Solo se pueden enviar fotos.'
  if (file.size > 10 * 1024 * 1024) return 'La foto pesa más de 10 MB.'
  return null
}
