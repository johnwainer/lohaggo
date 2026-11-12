import { prisma } from '@/lib/prisma'

/** Guías del blog que hablan de un servicio (por etiqueta o por título), solo indexables. */
export async function guidesForService(serviceName: string, take = 3) {
  const rows = await prisma.marketingPostVariant.findMany({
    where: {
      channel: 'WEB', webPublishedAt: { not: null, lte: new Date() }, slug: { not: null }, noindex: false,
      post: { status: { not: 'archived' } },
      OR: [
        { tags: { hasSome: [serviceName, serviceName.toLowerCase()] } },
        { post: { title: { contains: serviceName, mode: 'insensitive' } } },
      ],
    },
    orderBy: { webPublishedAt: 'desc' },
    take,
    select: { slug: true, post: { select: { title: true } } },
  })
  return rows.filter((r) => r.slug).map((r) => ({ slug: r.slug as string, title: r.post.title }))
}
