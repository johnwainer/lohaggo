import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET

async function uploadToCloudinary(file: File, folder: string): Promise<{ url: string; publicId: string }> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const base64 = buffer.toString('base64')
  const dataURI = `data:${file.type};base64,${base64}`

  const timestamp = Math.round(Date.now() / 1000)
  const signature = require('crypto')
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest('hex')

  const formData = new FormData()
  formData.append('file', dataURI)
  formData.append('folder', folder)
  formData.append('timestamp', timestamp.toString())
  formData.append('api_key', CLOUDINARY_API_KEY!)
  formData.append('signature', signature)

  const uploadType = file.type === 'application/pdf' ? 'raw' : 'image'
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${uploadType}/upload`,
    {
      method: 'POST',
      body: formData
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Cloudinary error:', error)
    throw new Error('Failed to upload to Cloudinary')
  }

  const data = await response.json()
  return {
    url: data.secure_url,
    publicId: data.public_id
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const partnerId = formData.get('partnerId') as string

    if (!file || !type || !partnerId) {
      return NextResponse.json({ error: 'Archivo, tipo y partnerId son requeridos' }, { status: 400 })
    }

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { id: partnerId },
      include: { user: true }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })
    }

    const { url, publicId } = await uploadToCloudinary(file, 'haggo/documents/background')

    const document = await prisma.verificationDocument.create({
      data: {
        partnerId: partnerId,
        type: type as any,
        documentUrl: url,
        publicId: publicId,
        status: 'APPROVED',
        reviewedBy: session.user.id,
        reviewedAt: new Date()
      }
    })

    await prisma.notification.create({
      data: {
        userId: partnerProfile.userId,
        type: 'DOCUMENT_APPROVED',
        title: 'Antecedentes aprobados',
        message: 'Tus antecedentes han sido verificados y aprobados',
        read: false
      }
    })

    const backgroundAchievement = await prisma.achievement.findUnique({
      where: { type: 'BACKGROUND_CHECK_VERIFIED' }
    })

    if (backgroundAchievement) {
      const existingAchievement = await prisma.partnerAchievement.findUnique({
        where: {
          partnerId_achievementId: {
            partnerId: partnerId,
            achievementId: backgroundAchievement.id
          }
        }
      })

      if (!existingAchievement) {
        await prisma.partnerAchievement.create({
          data: {
            partnerId: partnerId,
            achievementId: backgroundAchievement.id
          }
        })

        await prisma.notification.create({
          data: {
            userId: partnerProfile.userId,
            type: 'ACHIEVEMENT_UNLOCKED',
            title: '¡Logro desbloqueado!',
            message: `Has desbloqueado: ${backgroundAchievement.name}`,
            read: false
          }
        })
      }
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error uploading background check:', error)
    return NextResponse.json({ error: 'Error al subir antecedentes' }, { status: 500 })
  }
}
