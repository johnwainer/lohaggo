'use client'

import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace('.', ',')} M` : `$${Math.round(n).toLocaleString('es-CO')}`)
export const num = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('es-CO'))
export const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`)
export const hours = (h: number | null | undefined) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toLocaleString('es-CO', { maximumFractionDigits: 1 })} h` : `${Math.round(h / 24)} días`)
export const minutes = (m: number | null | undefined) => (m == null ? '—' : m < 1 ? `${Math.round(m * 60)} s` : m < 120 ? `${Math.round(m)} min` : `${(m / 60).toLocaleString('es-CO', { maximumFractionDigits: 1 })} h`)
export const dayLabel = (key: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00Z`))
export const monthLabel = (key: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'short', year: '2-digit' }).format(new Date(`${key}-15T12:00:00Z`))
export const CITY_LABEL: Record<string, string> = { MEDELLIN: 'Medellín', BOGOTA: 'Bogotá', CALI: 'Cali', BARRANQUILLA: 'Barranquilla' }

export function Change({ value, invert = false }: { value: number | null | undefined; invert?: boolean }) {
  if (value === undefined) return null
  if (value === null) return <span className="text-[11px] font-medium text-emerald-600">nuevo</span>
  if (value === 0) return <span className="text-[11px] text-gray-400">sin cambio</span>
  const good = invert ? value < 0 : value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${good ? 'text-emerald-600' : 'text-rose-600'}`}>
      {value > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(value).toLocaleString('es-CO')} %
    </span>
  )
}

export function Kpi({ label, value, change, invert, hint }: { label: string; value: string; change?: number | null; invert?: boolean; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <Change value={change} invert={invert} />
        {change !== undefined && <span className="text-[11px] text-gray-400">vs periodo anterior</span>}
        {hint && <span className="text-[11px] text-gray-500">{hint}</span>}
      </div>
    </div>
  )
}

export function Card({ title, subtitle, children, className = '', action }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Horizontal bars: name, bar relative to the largest value, formatted value and an optional detail. */
export function BarList({ rows, format = num, empty = 'Sin datos en este periodo.', color = 'bg-primary-500' }: { rows: Array<{ name: string; value: number; detail?: string }>; format?: (n: number) => string; empty?: string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="text-sm text-gray-500">{empty}</p>
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-gray-800">{r.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-gray-900">{format(r.value)}{r.detail && <span className="ml-1.5 text-xs font-normal text-gray-500">{r.detail}</span>}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{children}</div>
}

export const tooltipStyle = { borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,.12)', fontSize: 12 }
export const axis = { tick: { fill: '#9CA3AF', fontSize: 11 }, axisLine: false, tickLine: false } as const
