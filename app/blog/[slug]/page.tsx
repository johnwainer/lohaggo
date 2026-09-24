import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { findRedirect, getArticle, relatedArticles } from '@/lib/marketing/blog'
import { articleJsonLd, articleUrl, jsonLdScript, makeExcerpt, readingMinutes, renderMarkdown, SITE_URL } from '@/lib/marketing/seo'
import { deliveryUrl, ogImageUrl } from '@/lib/marketing/media'
import ViewBeacon from '@/components/blog/ViewBeacon'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const a = await getArticle(slug)
  if (!a) return { title: 'Artículo no encontrado – LoHaggo', robots: { index: false } }
  const title = a.seoTitle || a.post.title
  const description = a.seoDescription || a.excerpt || makeExcerpt(a.body, 158)
  const image = ogImageUrl(a.coverUrl || a.post.media[0]?.url || null) || `${SITE_URL}/icon-512.png`
  const url = a.canonicalUrl || articleUrl(slug)
  return {
    title,
    description,
    keywords: a.tags,
    alternates: { canonical: url },
    robots: a.noindex ? { index: false, follow: true } : { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: {
      type: 'article', title, description, url, siteName: 'LoHaggo', locale: 'es_CO',
      publishedTime: a.webPublishedAt?.toISOString(), modifiedTime: a.updatedAt.toISOString(),
      section: a.category || undefined, tags: a.tags,
      images: [{ url: image, width: 1200, height: 630, alt: a.post.title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image], creator: '@lohaggo' },
  }
}

const fmt = (d: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(d)

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const a = await getArticle(slug)
  if (!a) {
    // Old slug of an article that was renamed: 301 to the current URL
    const r = await findRedirect(`/blog/${slug}`)
    if (r) permanentRedirect(r.toPath)
    notFound()
  }
  const cover = a.coverUrl || a.post.media[0]?.url || null
  const description = a.seoDescription || a.excerpt || makeExcerpt(a.body, 158)
  const related = await relatedArticles(a.id, a.category, a.tags)
  const jsonLd = [
    articleJsonLd({ title: a.post.title, description, slug, image: ogImageUrl(cover), publishedAt: a.webPublishedAt!, updatedAt: a.updatedAt, category: a.category, tags: a.tags }),
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: a.post.title, item: articleUrl(slug) },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-white pb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <ViewBeacon slug={slug} />
      <article className="max-w-3xl mx-auto px-4 pt-6 sm:pt-10">
        <nav aria-label="Ruta" className="text-sm text-gray-500">
          <Link href="/" className="hover:text-primary-700">Inicio</Link> <span aria-hidden>›</span> <Link href="/blog" className="hover:text-primary-700">Blog</Link>
          {a.category && <> <span aria-hidden>›</span> <Link href={`/blog?categoria=${encodeURIComponent(a.category)}`} className="hover:text-primary-700">{a.category}</Link></>}
        </nav>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-tight text-gray-900">{a.post.title}</h1>
        <p className="mt-3 text-sm text-gray-500">
          <time dateTime={a.webPublishedAt!.toISOString()}>{fmt(a.webPublishedAt!)}</time> · {readingMinutes(a.body)} min de lectura
        </p>
        {cover && (
          <img src={deliveryUrl('WEB', cover, { kind: 'image' })} alt={a.post.media.find((m) => m.url === cover)?.alt || a.post.title} className="mt-6 w-full rounded-3xl object-cover aspect-[1.91/1] bg-gray-100" />
        )}
        <div
          className="mt-8 text-[17px] leading-8 text-gray-800 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-6 [&_h4]:font-semibold [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-primary-700 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_img]:my-6 [&_img]:rounded-2xl [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-gray-900 [&_pre]:p-4 [&_pre]:text-gray-100 [&_hr]:my-10"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(a.body) }}
        />
        {a.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {a.tags.map((t) => <span key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">#{t}</span>)}
          </div>
        )}
        <div className="mt-10 rounded-3xl bg-gradient-to-br from-primary-600 to-secondary-500 p-6 text-white">
          <p className="text-lg font-bold">¿Necesitas un profesional?</p>
          <p className="mt-1 text-white/90 text-sm">En LoHaggo encuentras profesionales verificados cerca de ti. Describe lo que necesitas y recibe propuestas.</p>
          <Link href="/" className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 hover:bg-white/90">Solicitar un servicio</Link>
        </div>
      </article>

      {related.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 mt-14">
          <h2 className="text-xl font-bold text-gray-900">También te puede servir</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            {related.map((r) => {
              const img = r.coverUrl || r.post.media[0]?.url
              return (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="group overflow-hidden rounded-3xl bg-gray-50 transition hover:shadow-md">
                  <div className="aspect-[1.91/1] bg-gray-100">{img && <img src={ogImageUrl(img) || img} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
                  <p className="p-4 font-semibold text-gray-900 group-hover:text-primary-700">{r.post.title}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
