import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { createNotification } from '@/lib/notifications/notificationService'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'

async function checkAndUnlockAchievements(partnerId: string) {
  const documents = await prisma.verificationDocument.findMany({
    where: { partnerId, status: 'APPROVED' }
  })

  const hasIdentity = documents.some(d => 
    ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'].includes(d.type)
  )
  const hasEducation = documents.some(d => 
    ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO'].includes(d.type)
  )
  const hasBackground = documents.some(d => d.type === 'ANTECEDENTES')

  const achievementsToUnlock = []
  
  if (hasIdentity) {
    achievementsToUnlock.push('IDENTITY_VERIFIED')
  }
  if (hasEducation) {
    achievementsToUnlock.push('EDUCATION_VERIFIED')
  }
  if (hasBackground) {
    achievementsToUnlock.push('BACKGROUND_CHECK_VERIFIED')
  }
  if (hasIdentity && hasEducation && hasBackground) {
    achievementsToUnlock.push('VERIFIED_PARTNER')
    await prisma.partnerProfile.update({
      where: { id: partnerId },
      data: { verified: true }
    })
  }

  for (const achievementType of achievementsToUnlock) {
    const achievement = await prisma.achievement.findUnique({
      where: { type: achievementType as any }
    })

    if (achievement) {
      const existing = await prisma.partnerAchievement.findUnique({
        where: {
          partnerId_achievementId: {
            partnerId,
            achievementId: achievement.id
          }
        }
      })

      if (!existing) {
        await prisma.partnerAchievement.create({
          data: {
            partnerId,
            achievementId: achievement.id
          }
        })

        const partner = await prisma.partnerProfile.findUnique({
          where: { id: partnerId },
          include: { user: true }
        })

        if (partner) {
          await createNotification({
            userId: partner.userId,
            type: 'ACHIEVEMENT_UNLOCKED',
            title: '¡Nuevo logro desbloqueado!',
            message: `Has desbloqueado: ${achievement.name}`,
            data: { achievementId: achievement.id }
          })
        }
      }
    }
  }
}


const logger = createLogger('admin-documents-review')

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { documentId, status, rejectionReason } = body

    if (!documentId || !status) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const document = await prisma.verificationDocument.findUnique({
      where: { id: documentId },
      include: {
        partner: {
          include: { user: true }
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const updatedDocument = await prisma.verificationDocument.update({
      where: { id: documentId },
      data: {
        status: status as any,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        reviewedBy: session.user.id,
        reviewedAt: new Date()
      }
    })

    await createNotification({
      userId: document.partner.userId,
      type: status === 'APPROVED' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
      title: status === 'APPROVED' ? 'Documento aprobado' : 'Documento rechazado',
      message: status === 'APPROVED'
        ? 'Tu documento ha sido aprobado exitosamente'
        : `Tu documento ha sido rechazado. Razón: ${rejectionReason}`,
      data: { documentId }
    })

    const partnerId = document.partner.userId

    if (status === 'APPROVED') {
      await checkAndUnlockAchievements(document.partnerId)

      // Auto-activate partner when an identity document is approved
      const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
      if (IDENTITY_TYPES.includes(document.type)) {
        await prisma.partnerProfile.update({
          where: { id: document.partnerId },
          data: { verified: true, isActive: true },
        })
        await prisma.partnerService.updateMany({
          where: { partnerId: document.partnerId },
          data: { active: true },
        })
        scheduleAutomationsForUser(partnerId, 'PARTNER_ACTIVATED', { contextId: document.id }).catch(() => null)
      }
      scheduleAutomationsForUser(partnerId, 'PARTNER_DOCS_APPROVED', { contextId: document.id }).catch(() => null)
    } else if (status === 'REJECTED') {
      scheduleAutomationsForUser(partnerId, 'PARTNER_DOCS_REJECTED', { contextId: document.id }).catch(() => null)
    }

    return NextResponse.json(updatedDocument)
  } catch (error) {
    logger.error('Error reviewing document:', error || undefined)
    return NextResponse.json({ error: 'Error al revisar documento' }, { status: 500 })
  }
}
