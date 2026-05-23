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

  const fetchUrl = document.documentUrl

  try {
    const response = await fetch(fetchUrl)
    if (!response.ok) {
      if (response.status === 401 && fetchUrl.endsWith('.pdf')) {
        return NextResponse.json(
          {
            error: 'Cloudinary está bloqueando la entrega de PDFs. Activa "Allow delivery of PDF and ZIP files" en Settings → Security del dashboard de Cloudinary.',
          },
          { status: 502 }
        )
      }
      return NextResponse.json({ error: 'No se pudo obtener el documento' }, { status: 502 })
    }

    const buffer = await response.arrayBuffer()

    // Detect content type: prefer what Cloudinary returns, fallback by URL
    const upstreamType = response.headers.get('content-type') || ''
    const isPdf = fetchUrl.endsWith('.pdf') || fetchUrl.includes('/raw/upload/') || upstreamType.includes('pdf')
    const contentType = isPdf ? 'application/pdf' : upstreamType || 'image/jpeg'
    const filename = isPdf ? 'documento.pdf' : 'documento.jpg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error al obtener el documento' }, { status: 500 })
  }
}
