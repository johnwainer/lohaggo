import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { shareKit } from '@/lib/seo/agent/share-core'

export const dynamic = 'force-dynamic'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** The service whose name (or its stem: "plomeria" ~ "plomero") appears in the text; the longest match wins. */
function inferService(haystack: string, names: string[]) {
  let best: string | null = null
  let bestLen = 0
  for (const name of names) {
    const n = norm(name)
    if (n.length < 4) continue
    const hit = haystack.includes(n) || (n.length >= 7 && haystack.includes(n.slice(0, 6)))
    if (hit && n.length > bestLen) { best = name; bestLen = n.length }
  }
  return best
}

const inferCity = (haystack: string, names: string[]) => names.find((n) => norm(n).length >= 3 && haystack.includes(norm(n))) ?? null

/** The 12 newest published articles with their ready-to-share texts. Any failure answers an empty list. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const now = new Date()
    const [rows, services, cities] = await Promise.all([
      prisma.marketingPostVariant.findMany({
        where: { channel: 'WEB', webPublishedAt: { not: null, lte: now }, slug: { not: null }, noindex: false, post: { status: { not: 'archived' } } },
        orderBy: { webPublishedAt: 'desc' },
        take: 12,
        select: { slug: true, excerpt: true, tags: true, category: true, webPublishedAt: true, post: { select: { title: true } } },
      }),
      prisma.service.findMany({ select: { name: true } }).catch(() => [] as { name: string }[]),
      prisma.cityConfig.findMany({ where: { status: 'ACTIVE' }, select: { name: true } }).catch(() => [] as { name: string }[]),
    ])
    const serviceNames = services.map((s) => s.name)
    const cityNames = cities.map((c) => c.name)
    const articles = rows.filter((r) => r.slug).map((r) => {
      const tags = r.tags ?? []
      const haystack = norm(`${r.post.title} ${tags.join(' ')} ${r.category ?? ''}`)
      const serviceName = inferService(haystack, serviceNames)
      const cityName = inferCity(haystack, cityNames)
      const kit = shareKit({ title: r.post.title, excerpt: r.excerpt, slug: r.slug!, tags, serviceName, cityName })
      return { slug: r.slug!, title: r.post.title, category: r.category, publishedAt: r.webPublishedAt, serviceName, cityName, kit }
    })
    return NextResponse.json({ articles })
  } catch {
    return NextResponse.json({ articles: [] })
  }
}
