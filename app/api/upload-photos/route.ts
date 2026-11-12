import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { cloudinaryService } from '@/lib/cloudinary'
import { handleApiError } from '@/lib/errors'
import { getCurrentUser } from '@/lib/auth'
import { validateUploadedImage } from '@/lib/file-validation'
import { overLimit } from '@/lib/rate-limit-store'

export const runtime = 'nodejs'
export const maxDuration = 60

const logger = createLogger('upload-photos')

const UPLOAD_WINDOW_MS = 10 * 60_000
const UPLOAD_MAX_REQUESTS = 20

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const limit = await overLimit(`upload-photos:${user.id}`, UPLOAD_WINDOW_MS, UPLOAD_MAX_REQUESTS)
    if (limit.blocked) {
      return NextResponse.json({ error: 'Demasiadas subidas. Intenta de nuevo en unos minutos.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } })
    }

    // Without storage configured nothing is written to the server's disk: it fails clearly
    if (!cloudinaryService.isEnabled()) {
      logger.error('Photo upload refused: image storage is not configured')
      return NextResponse.json({ error: 'El almacenamiento de imágenes no está disponible en este momento' }, { status: 503 })
    }

    const formData = await request.formData()
    const photos = formData.getAll('photos').filter((p): p is File => typeof p !== 'string')

    if (photos.length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron fotos' }, { status: 400 })
    }

    if (photos.length > 10) {
      return NextResponse.json({ error: 'Máximo 10 fotos permitidas' }, { status: 400 })
    }

    // Validate every file by its bytes (browser type and extension ignored) before uploading any
    const checked: File[] = []
    for (const photo of photos) {
      const check = await validateUploadedImage(photo)
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
      checked.push(check.file)
    }

    const uploadedUrls: string[] = []
    for (const photo of checked) {
      try {
        const result = await cloudinaryService.upload(photo, 'lohaggo/service-requests')
        uploadedUrls.push(result.url)
      } catch (error) {
        logger.error('Error uploading photo', error)
        return NextResponse.json({ error: 'Error al subir una de las fotos' }, { status: 500 })
      }
    }

    return NextResponse.json({ urls: uploadedUrls })
  } catch (error) {
    return handleApiError(error, 'upload-photos')
  }
}
