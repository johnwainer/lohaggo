/**
 * Technical read of one public page from its HTML. Pure: the fetch lives in page-audit.ts.
 * Rules follow what Google documents (title, description, one h1, canonical, structured data, alt, indexability).
 */
import type { PageAudit, PageIssue } from '@/lib/seo/agent/types'

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

const meta = (html: string, name: string) => {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  if (!tag) return null
  const v = tag.match(/content=["']([^"']*)["']/i)?.[1]
  return v != null ? decode(v) : null
}

function jsonLdTypes(html: string): string[] {
  const out: string[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const walk = (n: unknown) => {
        if (Array.isArray(n)) return n.forEach(walk)
        if (n && typeof n === 'object') {
          const o = n as Record<string, unknown>
          const t = o['@type']
          if (typeof t === 'string') out.push(t)
          else if (Array.isArray(t)) out.push(...t.filter((x): x is string => typeof x === 'string'))
          if (o['@graph']) walk(o['@graph'])
        }
      }
      walk(JSON.parse(m[1]))
    } catch {
      out.push('invalid')
    }
  }
  return Array.from(new Set(out))
}

export type PageKind = 'home' | 'service' | 'city' | 'price' | 'article' | 'index' | 'other'

/** Page kind from its path (decides which structured data is expected) */
export function pageKindOf(path: string): PageKind {
  if (path === '/' || path === '') return 'home'
  if (/^\/servicios\/[^/]+/.test(path)) return 'service'
  if (/^\/ciudad\/[^/]+/.test(path)) return 'city'
  if (/^\/precios\/[^/]+/.test(path)) return 'price'
  if (/^\/blog\/[^/]+/.test(path)) return 'article'
  if (['/servicios', '/precios', '/blog'].includes(path)) return 'index'
  return 'other'
}

const EXPECTED_LD: Partial<Record<PageKind, string[]>> = {
  home: ['Organization', 'WebSite'],
  service: ['Service', 'FAQPage', 'BreadcrumbList'],
  city: ['BreadcrumbList'],
  article: ['BlogPosting', 'Article'],
}

export function auditHtml(html: string, input: { url: string; path: string; status: number | null; expectIndex?: boolean }): PageAudit {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const description = meta(html, 'description')
  const robots = meta(html, 'robots')
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0]?.match(/href=["']([^"']*)["']/i)?.[1] ?? null
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length
  const imgs = html.match(/<img\b[^>]*>/gi) ?? []
  const imagesWithoutAlt = imgs.filter((t) => !/\balt=["'][^"']+["']/i.test(t)).length
  const ld = jsonLdTypes(html)
  const text = decode(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
  const words = text ? text.split(' ').length : 0
  const kind = pageKindOf(input.path)
  const issues: PageIssue[] = []
  const add = (code: string, severity: PageIssue['severity'], message: string) => issues.push({ code, severity, message })

  if (input.status != null && input.status !== 200) add('status', 'critical', `Responde ${input.status}`)
  const t = title ? decode(title) : null
  if (!t) add('title_missing', 'critical', 'Sin título')
  else if (t.length > 65) add('title_long', 'warning', `Título de ${t.length} caracteres (máx. 60): Google lo corta`)
  else if (t.length < 20) add('title_short', 'info', `Título de solo ${t.length} caracteres`)
  if (!description) add('description_missing', 'warning', 'Sin meta descripción')
  else if (description.length < 50) add('description_short', 'info', `Descripción de ${description.length} caracteres (mín. 50)`)
  else if (description.length > 165) add('description_long', 'info', `Descripción de ${description.length} caracteres (máx. 160)`)
  if (h1Count === 0) add('h1_missing', 'warning', 'Sin encabezado principal (h1)')
  else if (h1Count > 1) add('h1_multiple', 'info', `${h1Count} encabezados h1`)
  if (!canonical) add('canonical_missing', 'warning', 'Sin enlace canónico')
  const noindex = Boolean(robots && /noindex/i.test(robots))
  if (noindex && input.expectIndex !== false) add('noindex_unexpected', 'critical', 'Marcada noindex: Google no la indexa')
  if (!noindex && input.expectIndex === false) add('index_unexpected', 'info', 'Debería ser noindex y no lo es')
  if (imagesWithoutAlt > 0) add('img_alt', 'info', `${imagesWithoutAlt} ${imagesWithoutAlt === 1 ? 'imagen sin' : 'imágenes sin'} texto alternativo`)
  const expected = EXPECTED_LD[kind]
  if (expected && !noindex && !expected.some((e) => ld.includes(e))) add('structured_data', 'warning', `Sin datos estructurados (${expected.join(' / ')})`)
  if (ld.includes('invalid')) add('structured_data_invalid', 'warning', 'Datos estructurados con JSON inválido')
  if (words < 150 && kind !== 'other' && !noindex) add('thin', 'info', `Solo ${words} palabras visibles`)

  return { url: input.url, path: input.path, status: input.status, title: t, description, h1Count, canonical, robots, jsonLd: ld, imagesWithoutAlt, words, issues }
}
