import type { SeoOverview } from '@/lib/seo/agent/views'
import type { SeoConfig } from '@/lib/seo/agent/settings-core'

export type SeoData = SeoOverview & { defaults: SeoConfig; canEdit: boolean }

export async function seoApi<T = Record<string, unknown>>(url: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.json !== undefined ? 'POST' : 'GET'),
    headers: init?.json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { /* not JSON (gateway timeout page) */ }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : null
    throw new Error(msg || (res.status === 504 || res.status === 502 ? 'El servidor tardó demasiado. Revisa la actividad reciente: puede que el ciclo haya terminado.' : `No se pudo completar (HTTP ${res.status})`))
  }
  return data as T
}

export const WEEK_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export const nf = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('es-CO').format(n))
export const usd = (n: number) => `US$ ${n.toFixed(2)}`

export const fmtWhen = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'

export const LEVEL_LABEL: Record<string, string> = { low: 'bajo', medium: 'medio', high: 'alto' }
export const LEVEL_CLS: Record<string, string> = { low: 'bg-gray-100 text-gray-700', medium: 'bg-amber-100 text-amber-800', high: 'bg-emerald-100 text-emerald-800' }

export const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  ok: { label: 'Bien', cls: 'bg-emerald-100 text-emerald-800' },
  error: { label: 'Falló', cls: 'bg-rose-100 text-rose-700' },
  running: { label: 'En curso', cls: 'bg-blue-100 text-blue-800' },
  partial: { label: 'Parcial', cls: 'bg-amber-100 text-amber-800' },
  skipped: { label: 'Omitido', cls: 'bg-gray-100 text-gray-600' },
}
export const RUN_TYPE: Record<string, string> = { cycle: 'Ciclo', report: 'Informe semanal', brief: 'Brief' }
export const RUN_TRIGGER: Record<string, string> = { manual: 'manual', cron: 'automático', auto: 'automático' }

export const healthTone = (score: number) => (score >= 80 ? { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'Buena' } : score >= 50 ? { bar: 'bg-amber-500', text: 'text-amber-700', label: 'Regular' } : { bar: 'bg-rose-500', text: 'text-rose-700', label: 'Por mejorar' })

export const card = 'rounded-2xl border border-gray-200 bg-white p-4 sm:p-5'
export const btnPrimary = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 sm:min-h-[40px]'
export const btnGhost = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:min-h-[40px]'
export const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-500 sm:py-2 sm:text-sm'
