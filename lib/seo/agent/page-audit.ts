/**
 * Reads the site's own public pages the way a crawler does and runs the technical rules over each.
 * Server only: a short, polite sweep (4 at a time, 10 s each) of the pages that matter.
 */
import { SITE } from '@/lib/seo/agent/audit-core'
import { auditHtml } from '@/lib/seo/agent/page-audit-core'
import type { PageAudit } from '@/lib/seo/agent/types'

const UA = 'LoHaggoSeoAudit/1.0 (+https://www.lohaggo.com)'

async function fetchPage(path: string): Promise<PageAudit> {
  const url = `${SITE}${path === '/' ? '' : path}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(10_000) })
    const html = res.ok ? (await res.text()).slice(0, 600_000) : ''
    return auditHtml(html, { url, path, status: res.status })
  } catch (err) {
    return { url, path, status: null, title: null, description: null, h1Count: 0, canonical: null, robots: null, jsonLd: [], imagesWithoutAlt: 0, words: 0, issues: [{ code: 'unreachable', severity: 'critical', message: `No respondió: ${err instanceof Error ? err.message.slice(0, 80) : 'error'}` }] }
  }
}

/** Audits the paths in order with limited concurrency; `deadline` (epoch ms) stops early and returns what it read. */
export async function auditPages(paths: string[], deadline = Date.now() + 90_000, concurrency = 4): Promise<PageAudit[]> {
  const out: PageAudit[] = []
  let i = 0
  const worker = async () => {
    while (i < paths.length && Date.now() < deadline) {
      const path = paths[i++]
      out.push(await fetchPage(path))
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return out
}
