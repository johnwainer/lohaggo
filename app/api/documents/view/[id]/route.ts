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

  // PDFs hosted under /image/upload/ can be served as JPG via the pg_1
  // transform, which bypasses Cloudinary's "Restricted media types: PDF"
  // block. Old raw-uploaded PDFs (/raw/upload/) cannot be transformed and
  // require either a re-upload or the Cloudinary dashboard toggle.
  const url = new URL(req.url)
  const requestedPage = Math.max(1, Math.min(20, Number(url.searchParams.get('page') || '1') || 1))
  const isImagePdf = document.documentUrl.includes('/image/upload/') && document.documentUrl.endsWith('.pdf')
  const isRawPdf = document.documentUrl.includes('/raw/upload/') && document.documentUrl.endsWith('.pdf')

  let fetchUrl = document.documentUrl
  let forcePdfHeader = false

  if (isImagePdf) {
    fetchUrl = document.documentUrl
      .replace('/image/upload/', `/image/upload/pg_${requestedPage}/`)
      .replace(/\.pdf$/, '.jpg')
  }

  try {
    const response = await fetch(fetchUrl)
    if (!response.ok) {
      if (response.status === 401 && isRawPdf) {
        return NextResponse.json(
          {
            error: 'PDF antiguo subido como "raw" — Cloudinary bloquea su entrega y no se puede transformar. El socio debe re-subirlo (los uploads nuevos ya usan formato compatible) o activa el toggle "Allow delivery of PDF and ZIP files" en el dashboard de Cloudinary.',
          },
          { status: 502 }
        )
      }
      return NextResponse.json({ error: 'No se pudo obtener el documento' }, { status: 502 })
    }

    const buffer = await response.arrayBuffer()

    const upstreamType = response.headers.get('content-type') || ''
    const isPdf = forcePdfHeader || (!isImagePdf && (fetchUrl.endsWith('.pdf') || fetchUrl.includes('/raw/upload/') || upstreamType.includes('pdf')))
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
