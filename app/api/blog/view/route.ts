import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordPageView } from '@/lib/marketing/metrics'

export const dynamic = 'force-dynamic'

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|lighthouse|headless/i

/** Article read (a beacon from the page): one counter per article and day, no cookies, bots ignored. */
export async function POST(request: NextRequest) {
  if (BOT.test(request.headers.get('user-agent') || '')) return new NextResponse(null, { status: 204 })
  const body = await request.json().catch(() => ({}))
  const slug = typeof body.slug === 'string' ? body.slug.slice(0, 120) : ''
  if (!slug) return new NextResponse(null, { status: 204 })
  const v = await prisma.marketingPostVariant.findFirst({ where: { slug, channel: 'WEB', webPublishedAt: { not: null } }, select: { id: true } })
  if (v) await recordPageView(v.id).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
