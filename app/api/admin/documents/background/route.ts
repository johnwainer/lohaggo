import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const partnerId = formData.get('partnerId') as string

    if (!file || !partnerId) {
      return NextResponse.json({ error: 'Archivo y partnerId son requeridos' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadResponse = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'haggo/documents',
          resource_type: 'auto'
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(buffer)
    }) as any

    const document = await prisma.verificationDocument.create({
      data: {
        partnerId,
        type: 'ANTECEDENTES',
        documentUrl: uploadResponse.secure_url,
        publicId: uploadResponse.public_id,
        status: 'APPROVED',
        reviewedBy: session.user.id,
        reviewedAt: new Date()
      }
    })

    const partner = await prisma.partnerProfile.findUnique({
      where: { id: partnerId },
      include: { user: true }
    })

    if (partner) {
      await prisma.notification.create({
        data: {
          userId: partner.userId,
          type: 'DOCUMENT_APPROVED',
          title: 'Antecedentes verificados',
          message: 'Tus antecedentes han sido verificados y aprobados',
          data: JSON.stringify({ documentId: document.id })
        }
      })

      const achievement = await prisma.achievement.findUnique({
        where: { type: 'BACKGROUND_CHECK_VERIFIED' }
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

          await prisma.notification.create({
            data: {
              userId: partner.userId,
              type: 'ACHIEVEMENT_UNLOCKED',
              title: '¡Nuevo logro desbloqueado!',
              message: `Has desbloqueado: ${achievement.name}`,
              data: JSON.stringify({ achievementId: achievement.id })
            }
          })
        }
      }

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

      if (hasIdentity && hasEducation && hasBackground) {
        await prisma.partnerProfile.update({
          where: { id: partnerId },
          data: { verified: true }
        })

        const verifiedAchievement = await prisma.achievement.findUnique({
          where: { type: 'VERIFIED_PARTNER' }
        })

        if (verifiedAchievement) {
          const existingVerified = await prisma.partnerAchievement.findUnique({
            where: {
              partnerId_achievementId: {
                partnerId,
                achievementId: verifiedAchievement.id
              }
            }
          })

          if (!existingVerified) {
            await prisma.partnerAchievement.create({
              data: {
                partnerId,
                achievementId: verifiedAchievement.id
              }
            })

            await prisma.notification.create({
              data: {
                userId: partner.userId,
                type: 'ACHIEVEMENT_UNLOCKED',
                title: '¡Nuevo logro desbloqueado!',
                message: `Has desbloqueado: ${verifiedAchievement.name}`,
                data: JSON.stringify({ achievementId: verifiedAchievement.id })
              }
            })
          }
        }
      }
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error uploading background check:', error)
    return NextResponse.json({ error: 'Error al subir antecedentes' }, { status: 500 })
  }
}
