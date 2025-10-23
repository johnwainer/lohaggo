import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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

    if (photos.length > 5) {
      return NextResponse.json(
        { error: 'Máximo 5 fotos permitidas' },
        { status: 400 }
      )
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'requests')
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const urls: string[] = []

    for (const photo of photos) {
      const bytes = await photo.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(7)
      const extension = photo.name.split('.').pop()
      const filename = `${timestamp}-${randomString}.${extension}`
      const filepath = join(uploadDir, filename)

      await writeFile(filepath, buffer)
      urls.push(`/uploads/requests/${filename}`)
    }

    return NextResponse.json({ urls })
  } catch (error) {
    console.error('Error uploading photos:', error)
    return NextResponse.json(
      { error: 'Error al subir las fotos' },
      { status: 500 }
    )
  }
}
