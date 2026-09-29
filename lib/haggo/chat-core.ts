import { ADMIN_MENU, itemHref } from '@/components/admin/admin-menu'

/** Every page Haggo may link to: the admin menu, nothing invented. */
export const ALLOWED_LINKS: Array<{ label: string; href: string }> = ADMIN_MENU.flatMap((g) => g.items.map((i) => ({ label: i.label, href: itemHref(i) })))
const ALLOWED = new Set(ALLOWED_LINKS.map((l) => l.href))

export function linksBlock() {
  return ALLOWED_LINKS.map((l) => `- ${l.label}: ${l.href}`).join('\n')
}

/**
 * Keeps markdown links only when they point to an allowed admin page (an optional query or hash on the
 * same page is fine). Anything else keeps its text and loses the link.
 */
export function sanitizeLinks(text: string) {
  return text.replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,300})\)/g, (_m, label: string, url: string) => {
    const path = url.split(/[?#]/)[0]
    return ALLOWED.has(url) || ALLOWED.has(path) ? `[${label}](${url})` : label
  })
}

export const MAX_USER_CHARS = 4000
export const WINDOW = 20
export const RATE_PER_MINUTE = 10

export function cleanUserText(v: unknown) {
  return typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, MAX_USER_CHARS) : ''
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

/**
 * The turns the model sees: the last WINDOW messages, starting with the superadmin, consecutive turns
 * of the same side merged (the API wants them alternating). Each turn is capped so one long answer
 * cannot fill the context.
 */
export function buildWindow(messages: ChatTurn[], maxTurnChars = 6000): ChatTurn[] {
  const recent = messages.slice(-WINDOW)
  while (recent.length && recent[0].role !== 'user') recent.shift()
  const out: ChatTurn[] = []
  for (const m of recent) {
    const content = m.content.length > maxTurnChars ? `${m.content.slice(0, maxTurnChars)}…` : m.content
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content = `${last.content}\n\n${content}`
    else out.push({ role: m.role, content })
  }
  return out
}

/** Older messages go into a running summary in batches (not on every message, to keep it cheap). */
export function needsSummary(total: number, summarized: number, batch = 10) {
  return total - WINDOW - summarized >= batch
}

/**
 * `recordar` only works when the superadmin's own message asked to remember something: text read by a
 * tool (a customer message, a review) cannot plant a permanent note in Haggo's memory.
 */
export function askedToRemember(userText: string) {
  return /\b(recuerd|record[aá]|no olvid|ten(ga|lo)? en cuenta|anot[aá]|guard[aá] (esto|que|en tu memoria)|memoriz)/i.test(userText)
}

export const MAX_FACTS = 50

export function rateLimited(sentLastMinute: number) {
  return sentLastMinute >= RATE_PER_MINUTE
}

/** What the chat run stores: which tools it used, the directives it proposed (pending until confirmed). */
export type Proposal = { id: string; text: string; rule: unknown; status: 'pending' | 'saved' | 'discarded'; directiveId?: string }
export type ChatRunOutput = { tools: string[]; proposals: Proposal[]; recommendations: string[]; remembered: string[]; actions?: string[] }

/** What the chat must see first when the snapshot is long: alerts, then the rest in its own order. */
const SNAPSHOT_FIRST = ['at', 'unavailable', 'requestAttention', 'inbox', 'system', 'channels', 'aiProviders', 'guarantee', 'trust', 'payments', 'paymentIncidents', 'payouts', 'requests', 'partners', 'bookings', 'sales', 'aiActions', 'aiCost', 'webhooks', 'automations']
export const CHAT_SNAPSHOT_MAX = 12_000

/** The last snapshot as JSON for the chat: the important keys first, capped without cutting a key in half. */
export function snapshotForChat(snapshot: unknown, max = CHAT_SNAPSHOT_MAX) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return JSON.stringify(snapshot ?? null).slice(0, max)
  const obj = snapshot as Record<string, unknown>
  const keys = [...SNAPSHOT_FIRST.filter((k) => k in obj), ...Object.keys(obj).filter((k) => !SNAPSHOT_FIRST.includes(k))]
  const parts: string[] = []
  let size = 2
  const left: string[] = []
  for (const k of keys) {
    const part = `${JSON.stringify(k)}:${JSON.stringify(obj[k])}`
    if (size + part.length + 1 > max) { left.push(k); continue }
    parts.push(part)
    size += part.length + 1
  }
  return `{${parts.join(',')}}${left.length ? ` (sin espacio para: ${left.join(', ')})` : ''}`
}
