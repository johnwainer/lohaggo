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
