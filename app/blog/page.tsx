import type { Metadata } from 'next'
import Link from 'next/link'
import { BLOG_PAGE_SIZE, listArticles } from '@/lib/marketing/blog'
import { makeExcerpt, readingMinutes, SITE_URL } from '@/lib/marketing/seo'
import { ogImageUrl } from '@/lib/marketing/media'

export const revalidate = 300

type Props = { searchParams: Promise<{ page?: string; categoria?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page, categoria } = await searchParams
  const n = Number(page) || 1
  const title = categoria ? `${categoria} – Blog de LoHaggo` : 'Blog de LoHaggo – Consejos para tu hogar'
  const description = 'Guías, consejos y novedades sobre servicios para el hogar en Colombia: limpieza, plomería, electricidad, reparaciones y más.'
  const canonical = `${SITE_URL}/blog${categoria ? `?categoria=${encodeURIComponent(categoria)}` : ''}${n > 1 ? `${categoria ? '&' : '?'}page=${n}` : ''}`
  return {
    title,
    description,
    alternates: { canonical, types: { 'application/rss+xml': `${SITE_URL}/blog/rss.xml` } },
    openGraph: { title, description, url: canonical, siteName: 'LoHaggo', locale: 'es_CO', type: 'website', images: [{ url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 }] },
  }
}

const fmt = (d: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(d)

export default async function BlogPage({ searchParams }: Props) {
  const { page, categoria } = await searchParams
  // A database hiccup during the build must not break the deploy: the page regenerates in 5 min
  const data = await listArticles({ page: Number(page) || 1, category: categoria || null })
    .catch(() => ({ items: [], total: 0, page: 1, pages: 1, categories: [] as Array<{ name: string; count: number }> }))
  const href = (p: number, c?: string | null) => {
    const q = new URLSearchParams()
    if (c) q.set('categoria', c)
    if (p > 1) q.set('page', String(p))
    const s = q.toString()
    return `/blog${s ? `?${s}` : ''}`
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <section className="bg-gradient-to-br from-primary-600 to-secondary-500 text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Blog</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold">Consejos para tu hogar</h1>
          <p className="mt-2 max-w-2xl text-white/90">Guías prácticas de los profesionales de LoHaggo: mantenimiento, reparaciones y cómo elegir bien a quién contratar.</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 pt-6 sm:pt-8">
        {data.categories.length > 0 && (
          <nav aria-label="Categorías" className="flex gap-2 overflow-x-auto pb-2">
            <Link href="/blog" className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium shadow-sm ${!categoria ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>Todo</Link>
            {data.categories.map((c) => (
              <Link key={c.name} href={href(1, c.name)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium shadow-sm ${categoria === c.name ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
                {c.name} <span className="text-xs opacity-60">{c.count}</span>
              </Link>
            ))}
          </nav>
        )}

        {data.items.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center text-gray-500 shadow-sm">Pronto publicaremos los primeros artículos.</div>
        ) : (
          <div className={`${data.categories.length > 0 ? 'mt-5' : ''} grid gap-5 sm:grid-cols-2 lg:grid-cols-3`}>
            {data.items.map((a) => {
              const image = a.coverUrl || a.post.media[0]?.url || null
              return (
                <Link key={a.slug} href={`/blog/${a.slug}`} className="group overflow-hidden rounded-3xl bg-white shadow-sm transition hover:shadow-md">
                  <div className="aspect-[1.91/1] bg-gray-100 overflow-hidden">
                    {image
                      ? <img src={ogImageUrl(image) || image} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                      : <div className="h-full w-full bg-gradient-to-br from-primary-100 to-secondary-100" />}
                  </div>
                  <div className="p-5">
                    {a.category && <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">{a.category}</span>}
                    <h2 className="mt-3 text-lg font-bold text-gray-900 leading-snug group-hover:text-primary-700">{a.post.title}</h2>
                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">{a.excerpt || a.seoDescription || makeExcerpt(a.body, 150)}</p>
                    <p className="mt-3 text-xs text-gray-400">{a.webPublishedAt ? fmt(a.webPublishedAt) : ''} · {readingMinutes(a.body)} min de lectura</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {data.pages > 1 && (
          <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-3 text-sm">
            {data.page > 1 && <Link rel="prev" href={href(data.page - 1, categoria)} className="rounded-full bg-white px-4 py-2 shadow-sm hover:bg-gray-100">← Anteriores</Link>}
            <span className="text-gray-500">Página {data.page} de {data.pages}</span>
            {data.page < data.pages && <Link rel="next" href={href(data.page + 1, categoria)} className="rounded-full bg-white px-4 py-2 shadow-sm hover:bg-gray-100">Siguientes →</Link>}
          </nav>
        )}
        <p className="sr-only">{BLOG_PAGE_SIZE} artículos por página</p>
      </div>
    </div>
  )
}
