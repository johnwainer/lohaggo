/**
 * Web articles: slugs, excerpts, a small safe Markdown renderer and structured data. Pure functions.
 */

export const SITE_URL = 'https://www.lohaggo.com'
export const BLOG_PATH = '/blog'

export function slugify(text: string, max = 80) {
  const s = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  return cut.slice(0, cut.lastIndexOf('-') > 20 ? cut.lastIndexOf('-') : max).replace(/-+$/, '')
}

/** Markdown → plain text (for excerpts, meta descriptions and reading time). */
export function stripMarkdown(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function makeExcerpt(md: string, max = 160) {
  const text = stripMarkdown(md)
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).trim()}…`
}

export function readingMinutes(md: string) {
  const words = stripMarkdown(md).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Only http(s), relative and mailto links survive; anything else (javascript:, data:) is dropped. */
export function safeUrl(url: string) {
  const u = url.trim()
  if (/^(https?:\/\/|\/(?!\/)|mailto:|#)/i.test(u)) return u
  return null
}

function inline(text: string) {
  let out = escapeHtml(text)
  // images ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, '&'))
    return safe ? `<img src="${escapeHtml(safe)}" alt="${alt}" loading="lazy" />` : ''
  })
  // links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, '&'))
    if (!safe) return label
    const external = /^https?:\/\//i.test(safe) && !safe.startsWith(SITE_URL)
    return `<a href="${escapeHtml(safe)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`
  })
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  return out
}

/**
 * Markdown subset the editor produces: headings (## / ###), paragraphs, bullet and numbered lists,
 * quotes, images, links, bold, italics, inline code, fenced code. Everything is escaped first, so a
 * pasted <script> is shown as text, never executed.
 */
export function renderMarkdown(md: string) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let para: string[] = []
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null
  let quote: string[] = []
  let code: string[] | null = null

  const flushPara = () => { if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para = [] } }
  const flushList = () => { if (list) { html.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`); list = null } }
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`); quote = [] } }
  const flushAll = () => { flushPara(); flushList(); flushQuote() }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (code) {
      if (/^```/.test(line)) { html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = null } else code.push(raw)
      continue
    }
    if (/^```/.test(line)) { flushAll(); code = []; continue }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushAll()
      // The article title is the only h1: "#" in the body becomes h2
      const level = Math.min(4, Math.max(2, heading[1].length))
      html.push(`<h${level} id="${slugify(heading[2], 60)}">${inline(heading[2])}</h${level}>`)
      continue
    }
    const ul = line.match(/^\s*[-*+]\s+(.+)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (ul || ol) {
      flushPara(); flushQuote()
      const type = ul ? 'ul' : 'ol'
      if (!list || list.type !== type) { flushList(); list = { type, items: [] } }
      list.items.push((ul || ol)![1])
      continue
    }
    const q = line.match(/^\s*>\s?(.*)$/)
    if (q) { flushPara(); flushList(); quote.push(q[1]); continue }
    if (!line.trim()) { flushAll(); continue }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushAll(); html.push('<hr />'); continue }
    flushList(); flushQuote()
    para.push(line.trim())
  }
  if (code) html.push(`<pre><code>${escapeHtml((code as string[]).join('\n'))}</code></pre>`)
  flushAll()
  return html.join('\n')
}

export function articleUrl(slug: string) {
  return `${SITE_URL}${BLOG_PATH}/${slug}`
}

export function articleJsonLd(a: {
  title: string
  description: string
  slug: string
  image: string | null
  publishedAt: Date
  updatedAt: Date
  category?: string | null
  tags?: string[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.title.slice(0, 110),
    description: a.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl(a.slug) },
    url: articleUrl(a.slug),
    ...(a.image ? { image: [a.image] } : {}),
    datePublished: a.publishedAt.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    ...(a.category ? { articleSection: a.category } : {}),
    ...(a.tags?.length ? { keywords: a.tags.join(', ') } : {}),
    author: { '@type': 'Organization', name: 'LoHaggo', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'LoHaggo', logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
  }
}

/** JSON for a <script type="application/ld+json">: "</script>" inside a string must not close the tag. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
