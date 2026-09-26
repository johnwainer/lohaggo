'use client'

import { Globe } from 'lucide-react'
import { ChannelIcon } from '@/components/admin/ChannelIcon'
import { formatScore, reviewBadge } from '@/lib/marketing/editorial-rubric'

export type MkChannel = 'WEB' | 'FACEBOOK' | 'INSTAGRAM'
export const MK_CHANNELS: MkChannel[] = ['WEB', 'FACEBOOK', 'INSTAGRAM']

export const CHANNEL_NAME: Record<MkChannel, string> = { WEB: 'Sitio web', FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram' }

export function MkChannelIcon({ channel, size = 18 }: { channel: string; size?: number }) {
  if (channel === 'WEB') {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-gray-800 text-white shrink-0" style={{ width: size, height: size }} title="Sitio web">
        <Globe style={{ width: size * 0.62, height: size * 0.62 }} />
      </span>
    )
  }
  return <ChannelIcon channel={channel === 'FACEBOOK' ? 'MESSENGER' : 'INSTAGRAM'} size={size} />
}

export const POST_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-gray-100 text-gray-700' },
  review: { label: 'En revisión', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Aprobada', cls: 'bg-sky-100 text-sky-800' },
  scheduled: { label: 'Programada', cls: 'bg-violet-100 text-violet-800' },
  publishing: { label: 'Publicando', cls: 'bg-blue-100 text-blue-800' },
  published: { label: 'Publicada', cls: 'bg-emerald-100 text-emerald-800' },
  partial: { label: 'Publicada en parte', cls: 'bg-orange-100 text-orange-800' },
  failed: { label: 'Falló', cls: 'bg-red-100 text-red-700' },
  archived: { label: 'Archivada', cls: 'bg-gray-100 text-gray-400' },
}

export const PUB_STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Programada', cls: 'text-violet-700' },
  publishing: { label: 'Publicando…', cls: 'text-blue-700' },
  processing: { label: 'Meta está procesando el video…', cls: 'text-blue-700' },
  published: { label: 'Publicada', cls: 'text-emerald-700' },
  failed: { label: 'Falló', cls: 'text-red-600' },
  cancelled: { label: 'Cancelada', cls: 'text-gray-400' },
}

export function StatusChip({ status }: { status: string }) {
  const s = POST_STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
}

export const OBJECTIVES: Record<string, string> = {
  reach: 'Alcance', traffic: 'Tráfico al sitio', leads: 'Clientes potenciales', engagement: 'Interacción', sales: 'Solicitudes de servicio', brand: 'Marca',
}

export const CAMPAIGN_STATUS: Record<string, string> = { draft: 'Borrador', active: 'Activa', paused: 'Pausada', done: 'Terminada' }

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Bogota' }).format(new Date(d)) : '—'
export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(d)) : '—'
export const num = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('es-CO').format(n))

/** "2026-09-26T14:30" in Bogotá time for <input type="datetime-local"> and back. */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return ''
  const date = new Date(d)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '00'
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}
/** Bogotá has no DST: UTC-5 all year. */
export function fromLocalInput(v: string) {
  return v ? new Date(`${v}:00-05:00`) : null
}

export type Account = { id: string; name: string; workspaceId: string; channel: 'FACEBOOK' | 'INSTAGRAM'; ok: boolean; problem: string | null; tokenKind: string | null; userTokenExpiresAt: string | null }

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `Error ${res.status}`) as Error & { issues?: unknown }
    err.issues = (data as { issues?: unknown }).issues
    throw err
  }
  return data as T
}

export const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

/** The editorial review's state of a post (nothing when it was never reviewed). */
export function ReviewChip({ status, score, compact = false }: { status: string | null | undefined; score?: number | null; compact?: boolean }) {
  const b = reviewBadge(status, score)
  if (!b) return null
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${b.cls}`} title="Revisión editorial">{compact && status === 'approved' ? `✓ ${score != null ? `${formatScore(score)}/10` : ''}` : b.label}</span>
}
