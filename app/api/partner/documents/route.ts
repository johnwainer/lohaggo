import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { cloudinaryService } from '@/lib/cloudinary'
import { handleApiError } from '@/lib/errors'

const logger = createLogger('partner-documents')

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'PARTNER') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    return NextResponse.json(partnerProfile.documents)
  } catch (error) {
    return handleApiError(error, 'partner-documents-get')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'PARTNER') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file || !type) {
      return NextResponse.json({ error: 'Archivo y tipo son requeridos' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 })
    }

    // Use centralized cloudinary service
    const { url, publicId } = await cloudinaryService.upload(file, 'lohaggo/documents')

    const document = await prisma.verificationDocument.create({
      data: {
        partnerId: partnerProfile.id,
        type: type as any,
        documentUrl: url,
        publicId: publicId
      }
    })

    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: 'DOCUMENT_APPROVED',
        title: 'Documento subido',
        message: `Tu documento ${type} ha sido subido y está en revisión`,
        read: false
      }
    })

    return NextResponse.json(document)
  } catch (error) {
    return handleApiError(error, 'partner-documents-post')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'PARTNER') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json({ error: 'ID de documento requerido' }, { status: 400 })
    }

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const document = await prisma.verificationDocument.findFirst({
      where: {
        id: documentId,
        partnerId: partnerProfile.id
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    if (document.status !== 'PENDING') {
      return NextResponse.json({ error: 'Solo se pueden eliminar documentos pendientes' }, { status: 400 })
    }

    if (document.publicId) {
      // Use centralized cloudinary service to delete
      await cloudinaryService.delete(document.publicId)
    }

    await prisma.verificationDocument.delete({
      where: { id: documentId }
    })

    return NextResponse.json({ message: 'Documento eliminado' })
  } catch (error) {
    return handleApiError(error, 'partner-documents-delete')
  }
}
