import { listArticles } from '@/lib/marketing/blog'
import { articleUrl, makeExcerpt, SITE_URL } from '@/lib/marketing/seo'

export const revalidate = 600

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET() {
  const { items } = await listArticles({ page: 1 }).catch(() => ({ items: [] as Awaited<ReturnType<typeof listArticles>>['items'] }))
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Blog de LoHaggo</title>
<link>${SITE_URL}/blog</link>
<atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
<description>Consejos y guías de servicios para el hogar en Colombia</description>
<language>es-CO</language>
${items.map((a) => `<item>
<title>${esc(a.post.title)}</title>
<link>${articleUrl(a.slug!)}</link>
<guid isPermaLink="true">${articleUrl(a.slug!)}</guid>
${a.webPublishedAt ? `<pubDate>${a.webPublishedAt.toUTCString()}</pubDate>` : ''}
${a.category ? `<category>${esc(a.category)}</category>` : ''}
<description>${esc(a.excerpt || a.seoDescription || makeExcerpt(a.body, 200))}</description>
</item>`).join('\n')}
</channel>
</rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } })
}
