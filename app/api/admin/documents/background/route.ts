import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { cloudinaryService } from '@/lib/cloudinary'
import { handleApiError } from '@/lib/errors'
import { createNotification } from '@/lib/notifications/notificationService'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'
import { validateUploadedFile } from '@/lib/file-validation'

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

    const fileCheck = await validateUploadedFile(file)
    if (!fileCheck.ok) {
      return NextResponse.json({ error: fileCheck.error }, { status: 400 })
    }
    const { isPdf } = fileCheck

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { id: partnerId },
      include: { user: true }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })
    }

    const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
    const hasApprovedIdentity = await prisma.verificationDocument.findFirst({
      where: { partnerId, type: { in: IDENTITY_TYPES as any }, status: 'APPROVED' }
    })
    if (!hasApprovedIdentity) {
      return NextResponse.json(
        { error: 'El socio debe tener documento de identidad verificado primero' },
        { status: 400 }
      )
    }

    const resourceType = isPdf ? 'raw' : 'image'
    const { url, publicId } = await cloudinaryService.upload(file, 'lohaggo/documents/background', resourceType)

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

    await createNotification({
      userId: partnerProfile.userId,
      type: 'DOCUMENT_APPROVED',
      title: 'Antecedentes aprobados',
      message: 'Tus antecedentes han sido verificados y aprobados'
    })

    scheduleAutomationsForUser(partnerProfile.userId, 'PARTNER_DOCS_APPROVED', { contextId: document.id }).catch(() => null)

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

        await createNotification({
          userId: partnerProfile.userId,
          type: 'ACHIEVEMENT_UNLOCKED',
          title: '¡Logro desbloqueado!',
          message: `Has desbloqueado: ${backgroundAchievement.name}`
        })
      }
    }

    return NextResponse.json(document)
  } catch (error) {
    return handleApiError(error, 'admin-documents-background')
  }
}
