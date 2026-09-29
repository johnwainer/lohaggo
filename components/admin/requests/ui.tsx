'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AlertOctagon, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Info, X } from 'lucide-react'
import type { AttentionFlag } from './types'

export const cop = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
/** Calendar dates stored at noon/midnight UTC (scheduledDate, preferredDate, proposedDate) */
export const day = (d: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
/** Timestamps, shown in Bogotá time */
export const when = (d: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d))

export const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Activa', cls: 'bg-yellow-100 text-yellow-800' },
  ACCEPTED: { label: 'Aceptada', cls: 'bg-green-100 text-green-800' },
  EXPIRED: { label: 'Expirada', cls: 'bg-gray-100 text-gray-700' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

export const BOOKING_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Reserva pendiente', cls: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Reserva confirmada', cls: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'En curso', cls: 'bg-violet-100 text-violet-800' },
  COMPLETED: { label: 'Completada', cls: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'Reserva cancelada', cls: 'bg-red-100 text-red-700' },
}

export const PROPOSAL_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-800' },
  ACCEPTED: { label: 'Aceptada', cls: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rechazada', cls: 'bg-red-100 text-red-700' },
}

export const SEVERITY: Record<AttentionFlag['severity'], { box: string; chip: string; label: string; Icon: typeof Info }> = {
  critical: { box: 'border-red-200 bg-red-50 text-red-900', chip: 'bg-red-600 text-white', label: 'Crítico', Icon: AlertOctagon },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', chip: 'bg-amber-500 text-white', label: 'Atención', Icon: AlertTriangle },
  info: { box: 'border-sky-200 bg-sky-50 text-sky-900', chip: 'bg-sky-500 text-white', label: 'Info', Icon: Info },
}

export function Chip({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>
}

export function statusChip(map: Record<string, { label: string; cls: string }>, status: string) {
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' }
  return <Chip cls={s.cls}>{s.label}</Chip>
}

/** A card section; collapsible on phones, always open from md up. */
export function Section({ id, title, icon, count, children, defaultOpen = true, right, openSignal }: { id?: string; title: string; icon?: ReactNode; count?: number; children: ReactNode; defaultOpen?: boolean; right?: ReactNode; openSignal?: number }) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => { if (openSignal) setOpen(true) }, [openSignal])
  return (
    <section id={id} className="scroll-mt-20 min-w-0 rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left md:pointer-events-none">
          {icon && <span className="flex-shrink-0 text-primary-500">{icon}</span>}
          <h2 className="truncate text-sm font-bold text-gray-900 sm:text-base">{title}</h2>
          {count != null && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{count}</span>}
          <ChevronDown className={`ml-auto h-4 w-4 flex-shrink-0 text-gray-400 transition md:hidden ${open ? 'rotate-180' : ''}`} />
        </button>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
      <div className={`${open ? '' : 'hidden'} border-t border-gray-100 px-4 py-4 sm:px-5 md:block`}>{children}</div>
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-0.5 break-words text-sm text-gray-800">{children}</div>
    </div>
  )
}

/** Bottom sheet on phones, centered modal from sm up. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <p className="min-w-0 truncate text-base font-bold text-gray-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  )
}

export function Thumbs({ urls, onOpen, size = 'h-20 w-20' }: { urls: string[]; onOpen: (urls: string[], index: number) => void; size?: string }) {
  if (!urls.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <button key={`${u}-${i}`} type="button" onClick={() => onOpen(urls, i)} className={`block ${size} flex-shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  )
}

export function Lightbox({ urls, index, onClose }: { urls: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index)
  const many = urls.length > 1
  const go = (d: number) => setI((x) => (x + d + urls.length) % urls.length)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % urls.length)
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + urls.length) % urls.length)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, urls.length])
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-6 w-6" /></button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[i]} alt="" className="max-h-[85dvh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
      {many && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="Anterior" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="Siguiente" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">{i + 1} / {urls.length}</p>
        </>
      )}
    </div>
  )
}

export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50',
  danger: 'inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50',
  small: 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50',
}

export const input = 'w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none'
