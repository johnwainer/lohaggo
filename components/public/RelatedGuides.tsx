import Link from 'next/link'
import { guidesFor } from '@/lib/marketing/blog'

/**
 * «Guías» block, rendered on the server: links to the blog articles from the pages Google visits most (home,
 * services, cities). A new article is linked from all of them as soon as it is published, which is what makes
 * Google find and index it. Matching guides first, the newest ones to complete. Renders nothing without articles.
 */
export async function RelatedGuides({ serviceName, title = 'Guías para tu hogar', max = 4, className = '' }: { serviceName?: string; title?: string; max?: number; className?: string }) {
  const guides = await guidesFor(serviceName, max).catch(() => [])
  if (!guides.length) return null
  return (
    <section aria-label={title} className={`border-t border-gray-100 bg-white px-4 py-10 ${className}`}>
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link href={`/blog/${g.slug}`} className="block h-full rounded-2xl border border-gray-100 bg-gray-50 p-4 hover:border-primary-200 hover:bg-white">
                <span className="block font-semibold text-gray-900">{g.title}</span>
                {g.excerpt && <span className="mt-1 line-clamp-2 block text-sm leading-6 text-gray-600">{g.excerpt}</span>}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm"><Link href="/blog" className="font-semibold text-primary-700 underline">Ver todas las guías</Link></p>
      </div>
    </section>
  )
}
