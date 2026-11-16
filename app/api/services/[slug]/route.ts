import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { loadPublicService } from '@/lib/services/public-service'

export const dynamic = 'force-dynamic'

const logger = createLogger('services-slug')

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const citySlug = new URL(request.url).searchParams.get('city') || 'medellin'
  try {
    const r = await loadPublicService(slug, citySlug)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json(r.data)
  } catch (error) {
    logger.error('Error fetching servicio:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener servicio' }, { status: 500 })
  }
}
