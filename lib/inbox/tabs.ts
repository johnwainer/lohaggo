/** Inbox tabs: shared by the API (SQL in lib/inbox/list.ts) and the page (client-side «left the tab» labels). Pure. */

export const INBOX_TABS = ['awaiting', 'mine', 'ai', 'waiting', 'snoozed', 'closed', 'all'] as const
export type InboxTab = (typeof INBOX_TABS)[number]
export const DEFAULT_TAB: InboxTab = 'awaiting'

export const TAB_LABELS: Record<InboxTab, string> = {
  awaiting: 'Por responder',
  mine: 'Mías',
  ai: 'IA',
  waiting: 'Esperando al cliente',
  snoozed: 'Pospuestas',
  closed: 'Cerradas',
  all: 'Todas',
}

export function parseTab(raw: string | null | undefined): InboxTab {
  return (INBOX_TABS as readonly string[]).includes(raw || '') ? (raw as InboxTab) : DEFAULT_TAB
}

/** The fields of a list row the tabs depend on */
export type TabRow = {
  status: string
  assignedToId?: string | null
  aiHandled?: boolean
  inbox?: { awaitingReply: boolean; snoozedUntil: string | null } | null
}

function isOpen(row: TabRow) {
  return row.status === 'OPEN' || row.status === 'IN_PROGRESS'
}

function snoozed(row: TabRow, nowIso: string) {
  return Boolean(row.inbox?.snoozedUntil && row.inbox.snoozedUntil > nowIso)
}

/** Same rules as the SQL of each tab (lib/inbox/list.ts → tabSql). */
export function matchesTab(row: TabRow, tab: InboxTab, me: string, nowIso: string): boolean {
  const awaiting = Boolean(row.inbox?.awaitingReply)
  const sn = snoozed(row, nowIso)
  switch (tab) {
    case 'awaiting': return isOpen(row) && awaiting && !sn
    case 'mine': return isOpen(row) && row.assignedToId === me && !sn
    case 'ai': return isOpen(row) && Boolean(row.aiHandled)
    case 'waiting': return isOpen(row) && !awaiting && !sn
    case 'snoozed': return isOpen(row) && sn
    case 'closed': return !isOpen(row)
    default: return true
  }
}

/**
 * Why a row that is still shown no longer belongs to the tab (it stays until the list is refreshed):
 * «Pasó a IA», «Ya respondida», «Cerrada»… null when it still belongs.
 */
export function leftTabLabel(row: TabRow, tab: InboxTab, me: string, nowIso: string): string | null {
  if (matchesTab(row, tab, me, nowIso)) return null
  if (!isOpen(row)) return row.status === 'RESOLVED' ? 'Resuelta' : 'Cerrada'
  if (tab === 'closed') return 'Reabierta'
  if (snoozed(row, nowIso)) return 'Pospuesta'
  if (tab === 'ai') return 'La atiende una persona'
  if (tab === 'awaiting') return 'Ya respondida'
  if (row.aiHandled && tab === 'mine') return 'Pasó a IA'
  if (tab === 'mine') return 'Reasignada'
  if (tab === 'waiting') return 'Respondió el cliente'
  if (tab === 'snoozed') return 'Ya no está pospuesta'
  return 'Ya no está en esta pestaña'
}

/** «espera hace 2 h» */
export function waitingFor(sinceIso: string | null | undefined, now = Date.now()): string | null {
  if (!sinceIso) return null
  const mins = Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 60000))
  if (mins < 1) return 'espera hace un momento'
  if (mins < 60) return `espera hace ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `espera hace ${h} h`
  const d = Math.floor(h / 24)
  return `espera hace ${d} ${d === 1 ? 'día' : 'días'}`
}
