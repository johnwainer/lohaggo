import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const document = await prisma.verificationDocument.findUnique({
    where: { id },
    include: { partner: { select: { userId: true } } }
  })

  if (!document) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  // Only admin or the document owner can view
  const isAdmin = session.user.role === 'ADMIN'
  const isOwner = session.user.id === document.partner.userId
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Build the Cloudinary URL — force serving the original file for image/upload PDFs
  let fetchUrl = document.documentUrl
  if (fetchUrl.includes('/image/upload/') && !fetchUrl.includes('fl_attachment')) {
    fetchUrl = fetchUrl.replace('/image/upload/', '/image/upload/fl_attachment:false/')
  }

  try {
    const response = await fetch(fetchUrl)
    if (!response.ok) {
      return NextResponse.json({ error: 'No se pudo obtener el documento' }, { status: 502 })
    }

    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="documento.pdf"',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error al obtener el documento' }, { status: 500 })
  }
}
