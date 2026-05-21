/**
 * Server-side file validation using magic bytes.
 * Content-Type headers can be spoofed; magic bytes cannot.
 */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

// Magic byte signatures for allowed types
const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // "RIFF"
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // "%PDF"
]

function detectMimeFromBytes(buf: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    const off = sig.offset ?? 0
    const match = sig.bytes.every((b, i) => buf[off + i] === b)
    if (match) return sig.mime
  }
  return null
}

export type FileValidationResult =
  | { ok: true; mimeType: string; isPdf: boolean; buffer: Buffer }
  | { ok: false; error: string }

export async function validateUploadedFile(file: File): Promise<FileValidationResult> {
  if (file.size === 0) {
    return { ok: false, error: 'El archivo está vacío' }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'El archivo supera el tamaño máximo permitido (10 MB)' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const detectedMime = detectMimeFromBytes(buffer)

  if (!detectedMime) {
    return { ok: false, error: 'Tipo de archivo no permitido. Solo se aceptan PDF, JPG, PNG o WebP' }
  }

  const isImage = detectedMime.startsWith('image/')
  const isPdf = detectedMime === 'application/pdf'

  if (!isImage && !isPdf) {
    return { ok: false, error: 'Solo se permiten archivos PDF o imágenes (JPG, PNG, WebP)' }
  }

  return { ok: true, mimeType: detectedMime, isPdf, buffer }
}
