/**
 * Inbox attachments: validation by magic bytes, and mapping to the formats each channel accepts.
 * Files are hosted on Cloudinary (public URL) so Twilio and Meta can fetch them.
 */

export const INBOX_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024 // Vercel request body cap is ~4.5 MB

export type AttachmentKind = 'image' | 'audio' | 'video' | 'file'

type Signature = { mime: string; kind: AttachmentKind; check: (b: Uint8Array) => boolean }

const ascii = (b: Uint8Array, off: number, len: number) => Array.from(b.slice(off, off + len)).map((c) => String.fromCharCode(c)).join('')
const startsWith = (b: Uint8Array, bytes: number[], off = 0) => bytes.every((v, i) => b[off + i] === v)

const SIGNATURES: Signature[] = [
  { mime: 'image/jpeg', kind: 'image', check: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { mime: 'image/png', kind: 'image', check: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) },
  { mime: 'image/gif', kind: 'image', check: (b) => ascii(b, 0, 3) === 'GIF' },
  { mime: 'image/webp', kind: 'image', check: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP' },
  { mime: 'audio/wav', kind: 'audio', check: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE' },
  { mime: 'audio/ogg', kind: 'audio', check: (b) => ascii(b, 0, 4) === 'OggS' },
  { mime: 'audio/mpeg', kind: 'audio', check: (b) => ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { mime: 'audio/aac', kind: 'audio', check: (b) => b[0] === 0xff && (b[1] & 0xf6) === 0xf0 },
  { mime: 'audio/amr', kind: 'audio', check: (b) => ascii(b, 0, 6) === '#!AMR\n' },
  { mime: 'video/webm', kind: 'video', check: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]) },
  { mime: 'video/mp4', kind: 'video', check: (b) => ascii(b, 4, 4) === 'ftyp' },
  { mime: 'application/pdf', kind: 'file', check: (b) => ascii(b, 0, 4) === '%PDF' },
  { mime: 'application/zip', kind: 'file', check: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
]

const OFFICE_ZIP_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])
const TEXT_MIMES = new Set(['text/plain', 'text/csv'])

export type AttachmentValidation =
  | { ok: true; mime: string; kind: AttachmentKind; buffer: Buffer }
  | { ok: false; error: string }

export async function validateInboxAttachment(file: File): Promise<AttachmentValidation> {
  if (file.size === 0) return { ok: false, error: 'El archivo está vacío' }
  if (file.size > INBOX_ATTACHMENT_MAX_BYTES) return { ok: false, error: 'El adjunto supera el máximo permitido (4 MB)' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const head = new Uint8Array(buffer.subarray(0, 16))
  const declared = (file.type || '').toLowerCase()

  let sig = SIGNATURES.find((s) => s.check(head))

  // MP4 containers are shared by audio (m4a) and video: trust the declared type to pick the kind
  if (sig?.mime === 'video/mp4' && declared.startsWith('audio/')) sig = { mime: 'audio/mp4', kind: 'audio', check: () => true }
  if (sig?.mime === 'video/webm' && declared.startsWith('audio/')) sig = { mime: 'audio/webm', kind: 'audio', check: () => true }
  // Office documents are zip containers
  if (sig?.mime === 'application/zip' && OFFICE_ZIP_MIMES.has(declared)) sig = { mime: declared, kind: 'file', check: () => true }

  if (!sig) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const textExtOk = (declared === 'text/plain' && ext === 'txt') || (declared === 'text/csv' && ext === 'csv')
    if (TEXT_MIMES.has(declared) && textExtOk && isProbablyText(head)) return { ok: true, mime: declared, kind: 'file', buffer }
    return { ok: false, error: 'Tipo de archivo no permitido. Usa imágenes, audio, video, PDF, Office, TXT o CSV.' }
  }
  if (sig.mime === 'application/zip') return { ok: false, error: 'Los archivos ZIP no están permitidos' }

  return { ok: true, mime: sig.mime, kind: sig.kind, buffer }
}

function isProbablyText(head: Uint8Array) {
  return Array.from(head).every((c) => c === 0x09 || c === 0x0a || c === 0x0d || (c >= 0x20 && c < 0x7f) || c >= 0x80)
}

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/amr': 'amr', 'audio/mp4': 'm4a', 'audio/webm': 'weba',
  'video/webm': 'webm', 'video/mp4': 'mp4',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

/** Builds a safe storage name whose extension always matches the sniffed type (never .svg/.html/.js…). */
export function safeAttachmentName(originalName: string | undefined, mime: string) {
  const base = (originalName || 'adjunto').replace(/\.[^.]*$/, '').replace(/[^\w\-() ]+/g, '_').trim().slice(0, 80) || 'adjunto'
  const ext = MIME_EXTENSION[mime] || 'bin'
  return `${base}.${ext}`
}

export function kindFromMime(mime: string | null | undefined): AttachmentKind {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('audio/')) return 'audio'
  if (m.startsWith('video/')) return 'video'
  return 'file'
}

/** Cloudinary resource type for a given attachment kind (audio lives under "video"). */
export function cloudinaryResourceType(kind: AttachmentKind): 'image' | 'video' | 'raw' {
  if (kind === 'image') return 'image'
  if (kind === 'audio' || kind === 'video') return 'video'
  return 'raw'
}

const CLOUDINARY_HOST = /(^|\.)cloudinary\.com$/i

export function isTrustedAttachmentUrl(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && CLOUDINARY_HOST.test(u.hostname)
  } catch {
    return false
  }
}

export function attachmentLabel(kind: AttachmentKind, name?: string | null) {
  const icon = kind === 'image' ? '📷' : kind === 'audio' ? '🎤' : kind === 'video' ? '🎥' : '📎'
  const fallback = kind === 'image' ? 'Imagen' : kind === 'audio' ? 'Nota de voz' : kind === 'video' ? 'Video' : 'Archivo'
  return `${icon} ${name || fallback}`
}

/** WhatsApp (via Twilio) is strict about media formats; Messenger/Instagram are more lenient. */
const WHATSAPP_MIMES = new Set([
  'image/jpeg', 'image/png',
  'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg',
  'video/mp4', 'video/3gpp',
  'application/pdf', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

export function channelSupportsAttachment(channel: string, mime: string, kind: AttachmentKind): { ok: true } | { ok: false; error: string } {
  switch (channel) {
    case 'SMS':
      return { ok: false, error: 'SMS no admite adjuntos en Colombia (MMS solo existe en EE. UU. y Canadá). Envía el enlace en el texto.' }
    case 'WHATSAPP':
      if (!WHATSAPP_MIMES.has(mime)) return { ok: false, error: `WhatsApp no acepta el formato ${mime}. Usa JPG/PNG, MP3/OGG/M4A, MP4 o PDF/Office.` }
      return { ok: true }
    case 'INSTAGRAM':
      if (kind === 'file') return { ok: false, error: 'Instagram no admite documentos, solo imágenes, audio y video.' }
      return { ok: true }
    case 'MESSENGER':
      return { ok: true }
    default:
      return { ok: false, error: 'Canal sin soporte de adjuntos' }
  }
}
