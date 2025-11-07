import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { cloudinaryService } from '@/lib/cloudinary'
import { handleApiError } from '@/lib/errors'

const logger = createLogger('admin-documents-background')

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

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 })
    }

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { id: partnerId },
      include: { user: true }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })
    }

    const { url, publicId } = await cloudinaryService.upload(file, 'haggo/documents/background')

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
    return handleApiError(error, 'admin-documents-background')
  }
}
