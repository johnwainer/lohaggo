import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { refreshPostStatus } from '@/lib/marketing/publisher'

/** Published web articles: a WEB variant with webPublishedAt of a post that is not archived. */
const liveWhere = { channel: 'WEB' as const, webPublishedAt: { not: null, lte: new Date() }, slug: { not: null }, post: { status: { not: 'archived' } } }

export const BLOG_PAGE_SIZE = 12

export async function listArticles(opts: { page?: number; category?: string | null } = {}) {
  const page = Math.max(1, opts.page || 1)
  const where = { ...liveWhere, webPublishedAt: { not: null, lte: new Date() }, ...(opts.category ? { category: opts.category } : {}) }
  const [items, total, categories] = await Promise.all([
    prisma.marketingPostVariant.findMany({
      where,
      orderBy: { webPublishedAt: 'desc' },
      skip: (page - 1) * BLOG_PAGE_SIZE,
      take: BLOG_PAGE_SIZE,
      select: { slug: true, excerpt: true, seoDescription: true, coverUrl: true, category: true, webPublishedAt: true, body: true, post: { select: { title: true, media: { where: { kind: 'image' }, select: { url: true }, orderBy: { position: 'asc' }, take: 1 } } } },
    }),
    prisma.marketingPostVariant.count({ where }),
    prisma.marketingPostVariant.groupBy({ by: ['category'], where: { ...liveWhere, webPublishedAt: { not: null, lte: new Date() }, category: { not: null } }, _count: { _all: true } }),
  ])
  return { items, total, page, pages: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)), categories: categories.map((c) => ({ name: c.category!, count: c._count._all })) }
}

export async function getArticle(slug: string) {
  return prisma.marketingPostVariant.findFirst({
    where: { ...liveWhere, webPublishedAt: { not: null, lte: new Date() }, slug },
    include: { post: { select: { id: true, title: true, updatedAt: true, media: { where: { kind: 'image' }, orderBy: { position: 'asc' }, select: { url: true, alt: true } } } } },
  })
}

export async function relatedArticles(variantId: string, category: string | null, tags: string[]) {
  return prisma.marketingPostVariant.findMany({
    where: { ...liveWhere, webPublishedAt: { not: null, lte: new Date() }, id: { not: variantId }, OR: [...(category ? [{ category }] : []), ...(tags.length ? [{ tags: { hasSome: tags } }] : [])] },
    orderBy: { webPublishedAt: 'desc' },
    take: 3,
    select: { slug: true, excerpt: true, coverUrl: true, post: { select: { title: true, media: { where: { kind: 'image' }, select: { url: true }, take: 1 } } } },
  })
}

export async function sitemapArticles() {
  return prisma.marketingPostVariant.findMany({ where: { ...liveWhere, webPublishedAt: { not: null, lte: new Date() }, noindex: false }, select: { slug: true, updatedAt: true } })
}

export async function findRedirect(path: string) {
  return prisma.webRedirect.findUnique({ where: { fromPath: path } })
}

/** Takes the article offline (the post and its social publications stay). */
export async function unpublishArticle(postId: string) {
  const v = await prisma.marketingPostVariant.findUnique({ where: { postId_channel: { postId, channel: 'WEB' } } })
  if (!v) throw new Error('La publicación no tiene versión web')
  await prisma.marketingPostVariant.update({ where: { id: v.id }, data: { webPublishedAt: null } })
  await prisma.marketingPublication.updateMany({ where: { postId, channel: 'WEB', status: 'published' }, data: { status: 'cancelled', lastError: 'Despublicado del sitio' } })
  await refreshPostStatus(postId)
  try {
    revalidatePath('/blog')
    if (v.slug) revalidatePath(`/blog/${v.slug}`)
    revalidatePath('/sitemap.xml')
  } catch {
    // outside a request
  }
}

/** After editing a published article (or renaming its URL): refresh its page, the index and the sitemap. */
export async function revalidateLiveArticle(postId: string) {
  const v = await prisma.marketingPostVariant.findUnique({ where: { postId_channel: { postId, channel: 'WEB' } }, select: { slug: true, webPublishedAt: true } })
  if (!v?.webPublishedAt) return
  const redirects = v.slug ? await prisma.webRedirect.findMany({ where: { toPath: `/blog/${v.slug}` }, select: { fromPath: true } }) : []
  try {
    revalidatePath('/blog')
    if (v.slug) revalidatePath(`/blog/${v.slug}`)
    for (const r of redirects) revalidatePath(r.fromPath)
    revalidatePath('/sitemap.xml')
  } catch {
    // outside a request
  }
}
