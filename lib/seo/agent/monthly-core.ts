/** Monthly owner summary: pure functions (variations, what rose, what fell, what to do, email). */

export type MonthlyInput = {
  monthLabel: string
  gsc: {
    clicks: number; impressions: number; prevClicks: number | null; prevImpressions: number | null
    topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>
    topPages: Array<{ path: string; clicks: number; impressions: number }>
  } | null
  keywords: Array<{ keyword: string; position: number | null; prevPosition: number | null; impressions: number }>
  articles: { publishedThisMonth: Array<{ title: string; slug: string; views: number }>; totalPublished: number; indexed: number | null; inspected: number | null }
  health: { score: number; prevScore: number | null }
  opportunities: { open: number; highOpen: number; doneThisMonth: number }
  spendUsd: number
}

export type Change = { label: string; detail: string }
export type MonthlySummary = {
  monthLabel: string
  clicks: { value: number; prev: number | null; pct: number | null; text: string } | null
  impressions: { value: number; prev: number | null; pct: number | null; text: string } | null
  health: { score: number; prev: number | null; text: string }
  indexing: string | null
  articles: { publishedThisMonth: Array<{ title: string; slug: string; views: number }>; totalPublished: number }
  topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>
  topPages: Array<{ path: string; clicks: number; impressions: number }>
  rose: Change[]
  fell: Change[]
  todo: string[]
  opportunities: MonthlyInput['opportunities']
  spendUsd: number
  noPrevious: boolean
}

const NO_PREV = 'sin mes anterior para comparar'
const BOGOTA_OFFSET_MS = 5 * 3600_000

export const SITE = 'https://lohaggo.com'

/** Percent change, rounded to one decimal; null when there is no base to compare. */
export function pctChange(current: number, prev: number | null | undefined): number | null {
  if (prev == null || !Number.isFinite(prev) || !Number.isFinite(current)) return null
  if (prev === 0) return current === 0 ? 0 : null
  return Math.round(((current - prev) / prev) * 1000) / 10
}

/** ▲ with +, ▼ with -, and a dash when equal or unknown. */
export function arrow(pct: number | null): string {
  if (pct == null) return '–'
  if (pct > 0) return `▲ +${fmtPct(pct)}%`
  if (pct < 0) return `▼ -${fmtPct(Math.abs(pct))}%`
  return '– 0%'
}
const fmtPct = (n: number) => String(n).replace('.', ',')
const fmtInt = (n: number) => Math.round(n).toLocaleString('es-CO')

function parts(d: Date) {
  const b = new Date(d.getTime() - BOGOTA_OFFSET_MS)
  return { y: b.getUTCFullYear(), m: b.getUTCMonth() + 1, day: b.getUTCDate() }
}
const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM in Bogotá time. */
export function monthKey(now: Date): string {
  const p = parts(now)
  return `${p.y}-${pad(p.m)}`
}
export function previousMonthKey(keyOrDate: string | Date): string {
  const key = typeof keyOrDate === 'string' ? keyOrDate : monthKey(keyOrDate)
  const [y, m] = key.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`
}
/** Day of month (1-31) in Bogotá. */
export const bogotaDay = (now: Date) => parts(now).day

/** [start, end) of a month key as instants (Bogotá midnight). */
export function monthRange(key: string): { start: Date; end: Date } {
  const [y, m] = key.split('-').map(Number)
  return { start: new Date(Date.UTC(y, m - 1, 1) + BOGOTA_OFFSET_MS), end: new Date(Date.UTC(y, m, 1) + BOGOTA_OFFSET_MS) }
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function monthLabelOf(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} de ${y}`
}

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

function metric(label: string, value: number, prev: number | null | undefined) {
  const pct = pctChange(value, prev)
  const text = prev == null ? `${fmtInt(value)} ${label} (${NO_PREV})` : `${fmtInt(value)} ${label} (${arrow(pct)} frente a ${fmtInt(prev)} el mes anterior)`
  return { value, prev: prev ?? null, pct, text }
}

export function buildMonthly(input: MonthlyInput): MonthlySummary {
  const { gsc, keywords, articles, health, opportunities } = input
  const clicks = gsc ? metric('clics', gsc.clicks, gsc.prevClicks) : null
  const impressions = gsc ? metric('veces que apareciste en Google', gsc.impressions, gsc.prevImpressions) : null
  const healthText = health.prevScore == null ? `${health.score}/100 (${NO_PREV})` : `${health.score}/100 (${health.score - health.prevScore >= 0 ? '▲ +' : '▼ -'}${Math.abs(health.score - health.prevScore)} puntos)`
  const indexing = articles.inspected != null && articles.indexed != null ? `${articles.indexed} de ${articles.inspected} páginas revisadas ya están en Google` : null

  type Scored = Change & { score: number }
  const rose: Scored[] = []
  const fell: Scored[] = []
  for (const k of keywords) {
    const name = clip(k.keyword, 60)
    if (k.position != null && k.prevPosition != null) {
      const d = k.prevPosition - k.position
      if (d >= 1) rose.push({ label: name, detail: `subió del puesto ${k.prevPosition.toFixed(1).replace('.', ',')} al ${k.position.toFixed(1).replace('.', ',')}`, score: d * 10 + Math.log10(k.impressions + 1) })
      else if (d <= -1) fell.push({ label: name, detail: `bajó del puesto ${k.prevPosition.toFixed(1).replace('.', ',')} al ${k.position.toFixed(1).replace('.', ',')}`, score: -d * 10 + Math.log10(k.impressions + 1) })
    } else if (k.position != null && k.prevPosition == null && k.impressions > 0) {
      rose.push({ label: name, detail: `ya aparece en Google (puesto ${k.position.toFixed(1).replace('.', ',')})`, score: 8 + Math.log10(k.impressions + 1) })
    } else if (k.position == null) {
      fell.push({ label: name, detail: k.prevPosition != null ? 'dejó de aparecer en Google' : 'todavía no aparece en Google', score: (k.prevPosition != null ? 12 : 1) })
    }
  }
  const addTotal = (label: string, m: { pct: number | null } | null, value: number | undefined, prev: number | null | undefined) => {
    if (!m || m.pct == null || value == null || prev == null || m.pct === 0) return
    const c = { label, detail: `${m.pct > 0 ? 'subieron' : 'bajaron'} ${fmtPct(Math.abs(m.pct))}% (de ${fmtInt(prev)} a ${fmtInt(value)})`, score: Math.abs(m.pct) }
    ;(m.pct > 0 ? rose : fell).push(c)
  }
  addTotal('Clics desde Google', clicks, gsc?.clicks, gsc?.prevClicks)
  addTotal('Veces que apareciste en Google', impressions, gsc?.impressions, gsc?.prevImpressions)
  if (health.prevScore != null && health.score !== health.prevScore) {
    const d = health.score - health.prevScore
    ;(d > 0 ? rose : fell).push({ label: 'Salud del sitio', detail: `${d > 0 ? 'subió' : 'bajó'} ${Math.abs(d)} puntos (${health.prevScore} a ${health.score})`, score: Math.abs(d) })
  }
  const top = (l: Scored[]) => l.sort((a, b) => b.score - a.score).slice(0, 3).map(({ label, detail }) => ({ label, detail }))

  const todo = recommend(input, clicks?.pct ?? null)
  return {
    monthLabel: input.monthLabel, clicks, impressions, health: { score: health.score, prev: health.prevScore, text: healthText }, indexing,
    articles: { publishedThisMonth: articles.publishedThisMonth, totalPublished: articles.totalPublished },
    topQueries: gsc?.topQueries.slice(0, 5) ?? [], topPages: gsc?.topPages.slice(0, 5) ?? [],
    rose: top(rose), fell: top(fell), todo, opportunities, spendUsd: input.spendUsd,
    noPrevious: !gsc || gsc.prevClicks == null,
  }
}

/** Three plain actions for the month, in priority order. */
function recommend(i: MonthlyInput, clicksPct: number | null): string[] {
  const out: string[] = []
  const { articles, keywords, opportunities } = i
  if (!i.gsc) out.push('Conectar Search Console para ver cuánta gente te encuentra en Google: sin eso no podemos medir el avance.')
  if (articles.indexed != null && articles.inspected != null && articles.indexed < articles.inspected) {
    const n = articles.inspected - articles.indexed
    out.push(`Pedirle a Google que indexe ${n === 1 ? 'la página que todavía no está' : `las ${n} páginas que todavía no están`} en su buscador (en Search Console, «Inspeccionar URL» y «Solicitar indexación»).`)
  }
  if (articles.publishedThisMonth.length === 0) out.push('Publicar al menos un artículo por semana: este mes no salió ninguno y Google premia a los sitios que se mueven.')
  else if (articles.publishedThisMonth.length < 4) out.push(`Subir el ritmo: salieron ${articles.publishedThisMonth.length} ${articles.publishedThisMonth.length === 1 ? 'artículo' : 'artículos'} este mes; la meta es uno por semana.`)
  const missing = keywords.filter((k) => k.position == null)
  if (missing.length) out.push(`Enlazar a la página del servicio desde los artículos para ${clip(missing[0].keyword, 50)}${missing.length > 1 ? ` y otras ${missing.length - 1} búsquedas` : ''}, que todavía no aparecen en Google.`)
  const low = keywords.filter((k) => k.position != null && k.position > 10 && k.position <= 20 && k.impressions > 0)
  if (low.length) out.push(`Reforzar «${clip(low[0].keyword, 50)}»: está en el puesto ${low[0].position!.toFixed(0)} y con un empujón puede llegar a la primera página.`)
  if (clicksPct != null && clicksPct < 0) out.push('Revisar las páginas que más clics perdieron y actualizarlas con información al día, precios y fotos de trabajos reales.')
  if (opportunities.highOpen > 0) out.push(`Resolver las ${opportunities.highOpen} ${opportunities.highOpen === 1 ? 'oportunidad de alto impacto abierta' : 'oportunidades de alto impacto abiertas'} en el panel de SEO.`)
  out.push('Pedirle una reseña a cada cliente satisfecho: las calificaciones ayudan a que te elijan cuando te encuentran.')
  out.push('Compartir en redes y WhatsApp los artículos nuevos para que reciban las primeras visitas.')
  return out.slice(0, 3)
}

// ─── Email ───────────────────────────────────────────────────────────────────

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const e = (s: string, n = 90) => escapeHtml(clip(s.replace(/\s+/g, ' ').trim(), n))
const strip = (s: string) => clip(s.replace(/\s+/g, ' ').trim(), 90)

export function renderMonthlyEmail(s: MonthlySummary): { subject: string; html: string; text: string } {
  const subject = `Resumen de SEO de ${s.monthLabel}`.slice(0, 150)
  const lines: Array<[string, string]> = []
  if (s.clicks) lines.push(['Clics desde Google', s.clicks.text])
  if (s.impressions) lines.push(['Apariciones en Google', s.impressions.text])
  lines.push(['Salud del sitio', s.health.text])
  if (s.indexing) lines.push(['Páginas en Google', s.indexing])
  lines.push(['Artículos publicados', `${s.articles.publishedThisMonth.length} este mes (${s.articles.totalPublished} en total)`])

  const h = (t: string) => `<h3 style="margin:22px 0 8px;font-size:16px;color:#4c1d95">${escapeHtml(t)}</h3>`
  const ul = (items: string[]) => `<ul style="margin:0;padding-left:20px;line-height:1.55">${items.map((x) => `<li>${x}</li>`).join('')}</ul>`
  const row = ([k, v]: [string, string]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#555;width:38%">${escapeHtml(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee"><strong>${escapeHtml(v)}</strong></td></tr>`
  const changeLi = (c: Change) => `<strong>${e(c.label, 60)}</strong>: ${escapeHtml(c.detail)}`

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:600px;margin:0 auto">',
    `<h2 style="margin:0 0 4px;font-size:20px;color:#4c1d95">Resumen de SEO de ${escapeHtml(s.monthLabel)}</h2>`,
    '<p style="margin:0 0 12px;color:#666">Así le fue a LoHaggo en Google.</p>',
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #eee">${lines.map(row).join('')}</table>`,
    s.noPrevious ? `<p style="color:#888;font-size:12px">Para algunas cifras no hay ${escapeHtml(NO_PREV)}.</p>` : '',
    h('Lo que subió'),
    s.rose.length ? ul(s.rose.map(changeLi)) : '<p style="margin:0;color:#666">Nada subió de forma clara este mes.</p>',
    h('Lo que bajó o no aparece'),
    s.fell.length ? ul(s.fell.map(changeLi)) : '<p style="margin:0;color:#666">Nada bajó este mes.</p>',
    s.topQueries.length ? h('Lo que más buscan de ti') + ul(s.topQueries.map((q) => `${e(q.query, 70)}: ${fmtInt(q.clicks)} clics, puesto ${q.position ? q.position.toFixed(1).replace('.', ',') : '–'}`)) : '',
    s.articles.publishedThisMonth.length ? h('Artículos publicados este mes') + ul(s.articles.publishedThisMonth.slice(0, 10).map((a) => `<a href="${SITE}/blog/${encodeURIComponent(a.slug)}" style="color:#6d28d9">${e(a.title, 90)}</a> (${fmtInt(a.views)} ${a.views === 1 ? 'visita' : 'visitas'})`)) : '',
    h('Qué hacer este mes'),
    `<ol style="margin:0;padding-left:20px;line-height:1.55">${s.todo.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ol>`,
    `<p style="margin:22px 0 0;color:#666;font-size:12px">Oportunidades abiertas: ${s.opportunities.open} (${s.opportunities.highOpen} de alto impacto). Resueltas este mes: ${s.opportunities.doneThisMonth}. Gasto de IA del agente: US$ ${s.spendUsd.toFixed(2)}.</p>`,
    `<p style="margin:12px 0 0"><a href="${SITE}/admin/seo" style="color:#6d28d9">Abrir el panel de SEO</a></p>`,
    '</div>',
  ].join('')

  const text = [
    `Resumen de SEO de ${s.monthLabel}`, '',
    ...lines.map(([k, v]) => `${k}: ${v}`), '',
    'Lo que subió:', ...(s.rose.length ? s.rose.map((c) => `- ${strip(c.label)}: ${c.detail}`) : ['- Nada subió de forma clara este mes.']), '',
    'Lo que bajó o no aparece:', ...(s.fell.length ? s.fell.map((c) => `- ${strip(c.label)}: ${c.detail}`) : ['- Nada bajó este mes.']), '',
    'Qué hacer este mes:', ...s.todo.map((t, i) => `${i + 1}. ${t}`), '',
    `Panel: ${SITE}/admin/seo`,
  ].join('\n')
  return { subject, html, text }
}
