/**
 * Browser-side helpers for inbox attachments: voice notes (MediaRecorder → MP3 via lamejs),
 * image downscaling before upload, and the upload call itself.
 */

export type AttachmentKind = 'image' | 'audio' | 'video' | 'file'

export type UploadedAttachment = { url: string; mediaType: string; mediaName: string; kind: AttachmentKind; size: number }

export type PendingAttachment = {
  file: File
  kind: AttachmentKind
  previewUrl: string | null
  durationMs?: number
  uploaded?: UploadedAttachment
}

export function kindFromMime(mime: string | null | undefined): AttachmentKind {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('audio/')) return 'audio'
  if (m.startsWith('video/')) return 'video'
  return 'file'
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDuration(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ─── Images: downscale big photos so they fit the 4 MB upload cap ─────────────

const MAX_IMAGE_EDGE = 1600
const DOWNSCALE_THRESHOLD = 1.5 * 1024 * 1024

export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  if (file.size < DOWNSCALE_THRESHOLD) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export async function uploadAttachment(conversationId: string, file: File): Promise<UploadedAttachment> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/admin/inbox/conversations/${conversationId}/attachments`, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo subir el adjunto')
  return data.attachment as UploadedAttachment
}

// ─── Voice notes ─────────────────────────────────────────────────────────────

export function isRecordingSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'
}

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']
  return candidates.find((c) => MediaRecorder.isTypeSupported(c))
}

export class VoiceRecorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private startedAt = 0

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = pickMimeType()
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    this.chunks = []
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data) }
    this.recorder.start(250)
    this.startedAt = Date.now()
  }

  get elapsedMs() {
    return this.startedAt ? Date.now() - this.startedAt : 0
  }

  cancel() {
    try { this.recorder?.state !== 'inactive' && this.recorder?.stop() } catch { /* noop */ }
    this.stream?.getTracks().forEach((t) => t.stop())
    this.recorder = null
    this.stream = null
    this.chunks = []
  }

  /** Stops the recording and returns an MP3 file (playable on WhatsApp, Messenger and Instagram). */
  async stop(): Promise<{ file: File; durationMs: number }> {
    const recorder = this.recorder
    if (!recorder) throw new Error('No hay grabación en curso')
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
      if (recorder.state === 'inactive') resolve()
      else recorder.stop()
    })
    this.stream?.getTracks().forEach((t) => t.stop())
    const durationMs = Date.now() - this.startedAt
    const raw = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' })
    this.recorder = null
    this.stream = null
    this.chunks = []
    if (raw.size === 0) throw new Error('La grabación quedó vacía')
    const mp3 = await encodeToMp3(raw)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    return { file: new File([mp3], `nota-de-voz-${stamp}.mp3`, { type: 'audio/mpeg' }), durationMs }
  }
}

async function encodeToMp3(raw: Blob): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await raw.arrayBuffer())
  } finally {
    ctx.close().catch(() => null)
  }

  // Mono mixdown → 16-bit PCM
  const length = decoded.length
  const mono = new Float32Array(length)
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const data = decoded.getChannelData(ch)
    for (let i = 0; i < length; i++) mono[i] += data[i] / decoded.numberOfChannels
  }
  const pcm = new Int16Array(length)
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const encoder = new Mp3Encoder(1, decoded.sampleRate, 64)
  const parts: BlobPart[] = []
  const toPart = (chunk: Int8Array | Uint8Array): BlobPart => {
    const copy = new Uint8Array(new ArrayBuffer(chunk.length))
    copy.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length))
    return copy
  }
  const block = 1152
  for (let i = 0; i < pcm.length; i += block) {
    const chunk = encoder.encodeBuffer(pcm.subarray(i, i + block))
    if (chunk.length > 0) parts.push(toPart(chunk))
  }
  const tail = encoder.flush()
  if (tail.length > 0) parts.push(toPart(tail))
  return new Blob(parts, { type: 'audio/mpeg' })
}
