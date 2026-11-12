'use client'

import { useState } from 'react'
import { Calendar, CheckCircle, ShieldCheck, Star } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import PartnerReviewsPreview from '@/components/proposals/PartnerReviewsPreview'
import { buildComparison, type ComparableProposal } from '@/lib/proposals/compare'
import { PROPOSAL_BADGE_LABEL } from '@/lib/proposals/ranking'
import { formatCurrency } from '@/lib/utils'
import { formatCalendarDay } from '@/lib/bookings/when'

type Props = {
  open: boolean
  onClose: () => void
  serviceName: string
  proposals: ComparableProposal[]
  clientRatePct: number
  /** Show the LoHaggo guarantee line next to «Aceptar» (the `trust_guarantee` claim is on) */
  showGuarantee: boolean
  disabled?: boolean
  onAccept: (proposalId: string, partnerName: string, price: number) => void
}

/**
 * Compare sheet for phones: one card per proposal you can still choose, side by side in a swipeable row
 * (price with the service fee, proposed day, rating, last 2 reviews, checks passed and the guarantee next
 * to «Aceptar»).
 */
export default function CompareProposalsSheet({ open, onClose, serviceName, proposals, clientRatePct, showGuarantee, disabled, onAccept }: Props) {
  const rows = buildComparison(proposals, clientRatePct)
  const [showReviews, setShowReviews] = useState<string | null>(null)

  return (
    <BottomSheet open={open} onClose={onClose} title={`Comparar propuestas de ${serviceName}`} description="Desliza para ver cada una. La primera es la de mejor relación calidad-precio.">
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3" role="list">
        {rows.map((row) => {
          const { proposal: p } = row
          const rating = p.partner.rating ?? 0
          const reviews = p.partner.totalReviews ?? 0
          return (
            <article key={p.id} role="listitem" className="w-[82%] max-w-xs shrink-0 snap-center rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words text-base font-bold text-gray-900">{row.name}</p>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">#{row.position}</span>
              </div>
              {row.badges.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {row.badges.map((b) => (
                    <span key={b} className={`rounded-full px-2 py-0.5 text-xs font-bold ${b === 'best_rated' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{PROPOSAL_BADGE_LABEL[b]}</span>
                  ))}
                </div>
              )}

              <p className="mt-3 text-2xl font-black text-primary-700">{formatCurrency(row.total)}</p>
              <p className="text-xs text-gray-600">
                {row.fee > 0 ? `Servicio ${formatCurrency(p.price)} + tarifa ${formatCurrency(row.fee)}` : 'Sin tarifa de servicio'}
                {row.vsCheapest > 0 ? ` · +${formatCurrency(row.vsCheapest)} sobre la más económica` : ''}
              </p>

              <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-800">
                <Calendar size={14} className="shrink-0 text-primary-600" aria-hidden="true" />
                {p.proposedDate
                  ? `${formatCalendarDay(p.proposedDate, { weekday: 'short', day: 'numeric', month: 'short' })}${p.proposedTime ? ` · ${p.proposedTime}` : ''}`
                  : 'Día y hora por acordar'}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-800">
                <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden="true" />
                {reviews > 0 ? <><span className="font-semibold">{rating.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</span><span className="text-gray-600">({reviews} {reviews === 1 ? 'reseña' : 'reseñas'})</span></> : <span className="text-gray-700">Nuevo en LoHaggo</span>}
              </p>
              {row.verification.length > 0 && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-emerald-800">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>Verificado: {row.verification.join(', ')}</span>
                </p>
              )}
              {p.notes && <p className="mt-2 line-clamp-3 text-xs text-gray-600">{p.notes}</p>}

              {reviews > 0 && (
                <div className="mt-2">
                  <button type="button" aria-expanded={showReviews === p.id} onClick={() => setShowReviews(showReviews === p.id ? null : p.id)} className="min-h-[44px] text-sm font-semibold text-primary-700 underline-offset-2 hover:underline">
                    {showReviews === p.id ? 'Ocultar reseñas' : 'Ver las últimas reseñas'}
                  </button>
                  {showReviews === p.id && <PartnerReviewsPreview proposalId={p.id} />}
                </div>
              )}

              <button
                type="button"
                disabled={disabled}
                aria-label={`Aceptar la propuesta de ${row.name}`}
                onClick={() => { onClose(); onAccept(p.id, row.name, p.price) }}
                className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-3 text-base font-semibold text-white shadow-card hover:bg-emerald-800 disabled:opacity-50"
              >
                <CheckCircle size={18} aria-hidden="true" /> Aceptar
              </button>
              {showGuarantee && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-emerald-900">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span><span className="font-semibold">Garantía LoHaggo:</span> si no llega o queda mal, te conseguimos otro socio o lo corrige sin costo.</span>
                </p>
              )}
            </article>
          )
        })}
      </div>
    </BottomSheet>
  )
}
