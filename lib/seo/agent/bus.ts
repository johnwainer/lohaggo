/**
 * What the SEO agent says on the agent bus and what it does with what it hears. Never throws: sharing information
 * must not break a cycle.
 */
import { prisma } from '@/lib/prisma'
import { SITE } from '@/lib/seo/agent/audit-core'
import { markRead, openNotesFor, postNote, resolveNote } from '@/lib/agents/bus'
import type { SeoFacts } from '@/lib/seo/agent/audit-core'

const DAY = 86_400_000

/**
 * Notes addressed to SEO: a content request from another agent becomes an opportunity (and the note is answered);
 * learnings from marketing are returned for the weekly report; the rest is marked read.
 */
export async function processIncoming(): Promise<{ requests: number; learnings: string[] }> {
  let requests = 0
  const learnings: string[] = []
  try {
    const notes = await openNotesFor('seo', { limit: 30 })
    for (const n of notes) {
      if (n.topic === 'content_request' && n.kind === 'request') {
        const keyword = typeof (n.data as { keyword?: unknown } | null)?.keyword === 'string' ? String((n.data as { keyword: string }).keyword).slice(0, 80) : null
        const key = `note:${n.id}`
        const exists = await prisma.seoOpportunity.findUnique({ where: { dedupeKey: key }, select: { id: true } })
        if (!exists) {
          await prisma.seoOpportunity.create({
            data: { kind: 'content_gap', title: n.title.slice(0, 200), detail: `${n.body ?? ''}\n(Pedido por el agente «${n.fromAgent}»)`.trim(), keyword, impact: n.priority === 'high' ? 'high' : 'medium', effort: 'medium', source: 'marketing', dedupeKey: key, score: n.priority === 'high' ? 70 : 55 },
          }).catch(() => null)
          requests++
        }
        await resolveNote(n.id, 'seo', { title: 'Recibido: quedó como oportunidad de contenido', body: 'El agente de SEO escribirá el brief y lo enviará a marketing si encaja.' })
        await markRead('seo', [n.id])
      } else if (n.topic === 'learning') {
        learnings.push(`${n.title}: ${n.body ?? ''}`.slice(0, 500))
        await markRead('seo', [n.id])
      } else {
        await markRead('seo', [n.id])
      }
    }
  } catch { /* no notes this time */ }
  return { requests, learnings }
}

/** Articles published in the last days: the inbox bot may recommend them to customers. One note per article. */
export async function announceNewGuides(articles: SeoFacts['articles'], now = new Date()) {
  try {
    for (const a of articles.filter((x) => now.getTime() - x.publishedAt.getTime() < 4 * DAY).slice(0, 5)) {
      const excerpt = a.bodyText.slice(0, 220)
      await postNote({
        fromAgent: 'seo', toAgent: 'inbox', topic: 'new_guide', kind: 'insight',
        title: `Guía nueva: ${a.title}`, body: `${excerpt}… Enlace: ${SITE}/blog/${a.slug}. Recomiéndala solo si el cliente pregunta por ese tema.`,
        dedupeKey: `guide:${a.slug}`, ttlDays: 30, data: { url: `${SITE}/blog/${a.slug}`, slug: a.slug },
      })
    }
  } catch { /* a missing table or a blip: nothing to announce */ }
}

const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - y.getTime()) / DAY + 1) / 7)).padStart(2, '0')}`
}

/** The weekly indications for marketing, as a note the planner reads (once a week). */
export async function sendGuidanceToMarketing(forMarketing: string[], now = new Date()) {
  if (!forMarketing.length) return
  await postNote({
    fromAgent: 'seo', toAgent: 'marketing', topic: 'seo_guidance', kind: 'insight',
    title: 'Indicaciones del SEO para esta semana', body: forMarketing.map((f, i) => `${i + 1}) ${f}`).join(' '), dedupeKey: `seo-guidance:${isoWeek(now)}`, ttlDays: 8,
  }).catch(() => null)
}

