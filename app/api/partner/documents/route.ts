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

async function deleteFromCloudinary(publicId: string): Promise<void> {
  const timestamp = Math.round(Date.now() / 1000)
  const signature = require('crypto')
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest('hex')

  const formData = new FormData()
  formData.append('public_id', publicId)
  formData.append('timestamp', timestamp.toString())
  formData.append('api_key', CLOUDINARY_API_KEY!)
  formData.append('signature', signature)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
    {
      method: 'POST',
      body: formData
    }
  )

  if (!response.ok) {
    console.error('Failed to delete from Cloudinary')
  }
}

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
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'Error al obtener documentos' }, { status: 500 })
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

    const { url, publicId } = await uploadToCloudinary(file, 'haggo/documents')

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
    console.error('Error uploading document:', error)
    return NextResponse.json({ error: 'Error al subir documento' }, { status: 500 })
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
      await deleteFromCloudinary(document.publicId)
    }

    await prisma.verificationDocument.delete({
      where: { id: documentId }
    })

    return NextResponse.json({ message: 'Documento eliminado' })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 })
  }
}
