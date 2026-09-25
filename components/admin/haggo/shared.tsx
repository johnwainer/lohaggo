'use client'

import { DOMAIN_LABEL, type Domain } from '@/lib/haggo/config'

export const TZ = 'America/Bogota'

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error')
  return data as T
}

export const usd = (n: number) => `US$${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 })}`
export const when = (d: string | Date | null | undefined) => (d ? new Intl.DateTimeFormat('es-CO', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d)) : '—')
export function ago(d: string | Date | null | undefined) {
  if (!d) return '—'
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60_000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  return `hace ${Math.round(m / 1440)} d`
}
export function until(d: string | Date | null | undefined) {
  if (!d) return '—'
  const m = Math.round((new Date(d).getTime() - Date.now()) / 60_000)
  if (m <= 1) return 'en un momento'
  if (m < 60) return `en ${m} min`
  return when(d)
}

export const domainLabel = (d: string) => DOMAIN_LABEL[d as Domain] ?? d

const SEV = {
  critical: { label: 'Crítico', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  warning: { label: 'Aviso', cls: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  info: { label: 'Info', cls: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
} as const
export const sevMeta = (s: string) => SEV[s as keyof typeof SEV] ?? SEV.info
export function SeverityBadge({ severity }: { severity: string }) {
  const m = sevMeta(severity)
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}</span>
}

export const RUN_TYPE: Record<string, string> = { cycle: 'Ciclo', daily: 'Informe diario', weekly: 'Revisión semanal', chat: 'Conversación' }
export const TRIGGER: Record<string, string> = { schedule: 'programado', manual: 'manual', critical_incident: 'incidente crítico', ai_down: 'IA caída', error_spike: 'pico de errores' }
const RUN_STATUS = {
  ok: { label: 'Con análisis', cls: 'text-emerald-700' },
  skipped: { label: 'Sin novedades', cls: 'text-gray-500' },
  error: { label: 'Falló', cls: 'text-rose-600' },
  running: { label: 'En curso', cls: 'text-primary-600' },
} as const
export const runStatus = (s: string) => RUN_STATUS[s as keyof typeof RUN_STATUS] ?? RUN_STATUS.ok

export type Finding = { id: string; domain: string; severity: string; title: string; body: string | null; status: string; occurrences: number; createdAt: string; lastSeenAt: string; entityType: string | null; entityId: string | null }
export type Run = { id: string; type: string; trigger: string | null; status: string; summary: string | null; error: string | null; costUsd: number; startedAt: string; finishedAt: string | null }

export const card = 'bg-white rounded-2xl border border-gray-200'
export const btn = 'inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
export const btnPrimary = 'inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50'
