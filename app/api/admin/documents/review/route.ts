import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { createNotification } from '@/lib/notifications/notificationService'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'
import { waDocumentReviewed } from '@/lib/messaging/wa-events'
import { z } from 'zod'
import { auditAdminAction } from '@/lib/admin-utils'

const reviewSchema = z
  .object({
    documentId: z.string().min(1, 'Documento requerido'),
    status: z.enum(['APPROVED', 'REJECTED'], { errorMap: () => ({ message: 'Estado inválido: usa APPROVED o REJECTED' }) }),
    rejectionReason: z.string().trim().max(1000, 'La razón es demasiado larga').optional().nullable(),
  })
  .refine((d) => d.status !== 'REJECTED' || Boolean(d.rejectionReason && d.rejectionReason.length >= 3), {
    message: 'Escribe la razón del rechazo',
    path: ['rejectionReason'],
  })

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
          select: { userId: true },
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

    const parsed = reviewSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos incompletos' }, { status: 400 })
    }
    const { documentId, status } = parsed.data
    const rejectionReason = status === 'REJECTED' ? parsed.data.rejectionReason ?? '' : undefined

    const document = await prisma.verificationDocument.findUnique({
      where: { id: documentId },
      include: {
        partner: {
          select: { id: true, userId: true, user: { select: { id: true, name: true, email: true, phone: true } } },
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const updatedDocument = await prisma.verificationDocument.update({
      where: { id: documentId },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        reviewedBy: session.user.id,
        reviewedAt: new Date()
      }
    })

    const partnerId = document.partner.userId

    if (status === 'APPROVED') {
      await checkAndUnlockAchievements(document.partnerId)

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

      // Auto-activate isCompany when Cámara de Comercio is approved
      if (document.type === 'CAMARA_COMERCIO') {
        await prisma.partnerProfile.update({
          where: { id: document.partnerId },
          data: { isCompany: true },
        })
      }

      scheduleAutomationsForUser(partnerId, 'PARTNER_DOCS_APPROVED', { contextId: document.id }).catch(() => null)
    } else if (status === 'REJECTED') {
      scheduleAutomationsForUser(partnerId, 'PARTNER_DOCS_REJECTED', { contextId: document.id }).catch(() => null)
    }

    // C5 / C6 / C7 by WhatsApp template (after activation, so C7 lists the services now active)
    await waDocumentReviewed(documentId, status, rejectionReason)

    await createNotification({
      userId: document.partner.userId,
      type: status === 'APPROVED' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
      title: status === 'APPROVED' ? 'Documento aprobado' : 'Documento rechazado',
      message: status === 'APPROVED'
        ? 'Tu documento ha sido aprobado exitosamente'
        : `Tu documento ha sido rechazado. Razón: ${rejectionReason}`,
      data: { documentId }
    })

    await auditAdminAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: status === 'APPROVED' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
      entityType: 'VerificationDocument',
      entityId: documentId,
      route: '/api/admin/documents/review',
      details: JSON.stringify({
        partnerId: document.partnerId,
        type: document.type,
        previousStatus: document.status,
        ...(status === 'REJECTED' ? { reason: rejectionReason } : {}),
      }),
      request: req,
    })

    return NextResponse.json(updatedDocument)
  } catch (error) {
    logger.error('Error reviewing document:', error || undefined)
    return NextResponse.json({ error: 'Error al revisar documento' }, { status: 500 })
  }
}
