import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { createLogger } from '@/lib/logger'
import { cloudinaryService } from '@/lib/cloudinary'
import { handleApiError } from '@/lib/errors'

export const runtime = 'nodejs'
export const maxDuration = 60

const logger = createLogger('upload-photos')

async function uploadToLocal(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const uploadDir = join(process.cwd(), 'public', 'uploads', 'requests')

  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true })
  }

  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(7)
  const extension = file.name.split('.').pop()
  const filename = `${timestamp}-${randomString}.${extension}`
  const filepath = join(uploadDir, filename)

  await writeFile(filepath, buffer)
  return `/uploads/requests/${filename}`
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const photos = formData.getAll('photos') as File[]

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron fotos' },
        { status: 400 }
      )
    }

    if (photos.length > 10) {
      return NextResponse.json(
        { error: 'Máximo 10 fotos permitidas' },
        { status: 400 }
      )
    }

    const uploadedUrls: string[] = []

    for (const photo of photos) {
      if (!photo.type.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Solo se permiten archivos de imagen' },
          { status: 400 }
        )
      }

      if (photo.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'El tamaño máximo por foto es 10MB' },
          { status: 400 }
        )
      }

      try {
        let url: string

        if (cloudinaryService.isEnabled()) {
          const result = await cloudinaryService.upload(photo, 'lohaggo/service-requests')
          url = result.url
        } else {
          url = await uploadToLocal(photo)
        }

        uploadedUrls.push(url)
      } catch (error) {
        logger.error('Error uploading photo', error)
        return NextResponse.json(
          { error: 'Error al subir una de las fotos' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ urls: uploadedUrls })
  } catch (error) {
    return handleApiError(error, 'upload-photos')
  }
}
