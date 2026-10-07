'use client'

import { ChevronRight, Sparkles } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'

export type InProgressItem = {
  id: string
  title: string
  /** Service slug and emoji for the icon */
  slug?: string
  icon?: string
  /** Short state chip: «Solicitud activa», «Confirmada», «Por pagar» */
  chip: string
  chipClass: string
  /** One line: when, and what happens next */
  detail: string
  /** 'you' = the person has to act now: the row is highlighted and goes first */
  actor: 'you' | 'them' | 'none'
  onOpen: () => void
}

/**
 * The first thing in the client's and the partner's overview: everything still open (requests waiting
 * for proposals, bookings on their way, payments to settle), with what each one needs and who acts.
 */
export default function InProgressPanel({ items, emptyText, emptyAction, onSeeAll, seeAllLabel = 'Ver todo', max = 4 }: {
  items: InProgressItem[]
  emptyText: string
  emptyAction?: { label: string; onClick: () => void }
  onSeeAll?: () => void
  seeAllLabel?: string
  max?: number
}) {
  const sorted = [...items].sort((a, b) => Number(b.actor === 'you') - Number(a.actor === 'you'))
  const yours = items.filter((i) => i.actor === 'you').length
  const shown = sorted.slice(0, max)

  if (!items.length) {
    return (
      <section aria-labelledby="en-curso-title" className="rounded-3xl border-2 border-dashed border-primary-200 bg-primary-50/50 p-4 sm:p-5">
        <h2 id="en-curso-title" className="text-base font-bold text-slate-900">En curso</h2>
        <p className="mt-1 text-sm text-slate-600">{emptyText}</p>
        {emptyAction && (
          <button
            type="button"
            onClick={emptyAction.onClick}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <Sparkles size={16} aria-hidden="true" /> {emptyAction.label}
          </button>
        )}
      </section>
    )
  }

  return (
    <section aria-labelledby="en-curso-title" className="overflow-hidden rounded-3xl border-2 border-primary-500 bg-white shadow-lg">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id="en-curso-title" className="text-lg font-bold text-white">
            En curso <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-sm font-bold text-primary-700">{items.length}</span>
          </h2>
          <p className="text-xs text-white/90">
            {yours > 0 ? `${yours} ${yours === 1 ? 'necesita' : 'necesitan'} algo de ti` : 'Nada pendiente de ti por ahora'}
          </p>
        </div>
        {onSeeAll && items.length > max && (
          <button
            type="button"
            onClick={onSeeAll}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 text-sm font-semibold text-white hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {seeAllLabel} <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className="divide-y divide-slate-100">
        {shown.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.onOpen}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 sm:px-5 ${item.actor === 'you' ? 'bg-amber-50/70' : ''}`}
            >
              {item.slug
                ? <ServiceIcon slug={item.slug} emoji={item.icon || '🛠️'} size="md" />
                : <span className="text-2xl" aria-hidden="true">{item.icon || '🛠️'}</span>}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-semibold text-slate-900">{item.title}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${item.chipClass}`}>{item.chip}</span>
                </span>
                <span className={`mt-0.5 block text-xs ${item.actor === 'you' ? 'font-semibold text-amber-900' : 'text-slate-600'}`}>
                  {item.actor === 'you' && <span>Te toca a ti · </span>}
                  {item.detail}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-slate-500" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
