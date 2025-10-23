import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Cloudinary configuration (optional - for production)
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET

const USE_CLOUDINARY = !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET)

async function uploadToCloudinary(file: File): Promise<{ url: string; publicId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', 'service_requests') // You need to create this preset in Cloudinary
  formData.append('folder', 'service-requests')

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  )

  if (!response.ok) {
    throw new Error('Failed to upload to Cloudinary')
  }

  const data = await response.json()
  return {
    url: data.secure_url,
    publicId: data.public_id
  }
}

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

    if (photos.length > 5) {
      return NextResponse.json(
        { error: 'Máximo 5 fotos permitidas' },
        { status: 400 }
      )
    }

    const urls: string[] = []
    const publicIds: string[] = []

    if (USE_CLOUDINARY) {
      // Upload to Cloudinary (production)
      for (const photo of photos) {
        const { url, publicId } = await uploadToCloudinary(photo)
        urls.push(url)
        publicIds.push(publicId)
      }
    } else {
      // Upload to local filesystem (development)
      for (const photo of photos) {
        const url = await uploadToLocal(photo)
        urls.push(url)
        publicIds.push('') // No publicId for local files
      }
    }

    return NextResponse.json({ urls, publicIds })
  } catch (error) {
    console.error('Error uploading photos:', error)
    return NextResponse.json(
      { error: 'Error al subir las fotos' },
      { status: 500 }
    )
  }
}
