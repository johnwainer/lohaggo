import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { holdAgentPost, refreshPostStatus } from '@/lib/marketing/publisher'

/** Published web articles: a WEB variant with webPublishedAt of a post that is not archived. */
const liveWhere = { channel: 'WEB' as const, webPublishedAt: { not: null, lte: new Date() }, slug: { not: null }, post: { status: { not: 'archived' } } }

export const BLOG_PAGE_SIZE = 24

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

/**
 * Guides to link from a page: the ones about the service first (by title, category or tag), the newest to
 * complete up to `max`. Every page that shows them links the newest articles, so Google finds them quickly.
 */
export async function guidesFor(serviceName: string | string[] | undefined, max = 4) {
  const now = new Date()
  const select = { slug: true, excerpt: true, post: { select: { title: true } } } as const
  const base = { ...liveWhere, webPublishedAt: { not: null, lte: now }, noindex: false }
  const names = (Array.isArray(serviceName) ? serviceName : [serviceName]).map((n) => n?.trim()).filter((n): n is string => Boolean(n))
  const about = names.length
    ? await prisma.marketingPostVariant.findMany({
        where: { ...base, OR: names.flatMap((name) => [{ category: { contains: name, mode: 'insensitive' as const } }, { tags: { has: name } }, { post: { title: { contains: name, mode: 'insensitive' as const } } }]) },
        orderBy: { webPublishedAt: 'desc' }, take: max, select,
      })
    : []
  const rest = about.length < max
    ? await prisma.marketingPostVariant.findMany({ where: { ...base, slug: { notIn: about.map((a) => a.slug!).filter(Boolean) } }, orderBy: { webPublishedAt: 'desc' }, take: max - about.length, select })
    : []
  return [...about, ...rest].map((a) => ({ slug: a.slug!, title: a.post.title, excerpt: a.excerpt }))
}

/** Pages that link the newest guides: refreshed when an article goes live or comes down. */
export function revalidateGuideLinks() {
  try {
    revalidatePath('/')
    revalidatePath('/servicios/[slug]', 'layout')
    revalidatePath('/ciudad/[slug]', 'page')
  } catch {
    // outside a request
  }
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
  // A person took it down: the agent must not put it back
  await holdAgentPost(postId)
  await refreshPostStatus(postId)
  try {
    revalidatePath('/blog')
    if (v.slug) revalidatePath(`/blog/${v.slug}`)
    revalidatePath('/sitemap.xml')
  } catch {
    // outside a request
  }
  revalidateGuideLinks()
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
  revalidateGuideLinks()
}
