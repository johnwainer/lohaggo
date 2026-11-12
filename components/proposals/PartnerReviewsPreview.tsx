'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import type { ReviewPreview } from '@/lib/proposals/compare'

const cache = new Map<string, ReviewPreview[]>()

/** The latest two reviews of the partner behind a proposal, loaded when shown (inline: no new tab). */
export default function PartnerReviewsPreview({ proposalId, className = '' }: { proposalId: string; className?: string }) {
  const [reviews, setReviews] = useState<ReviewPreview[] | null>(cache.get(proposalId) ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (cache.has(proposalId)) return
    let alive = true
    fetch(`/api/proposals/${proposalId}/reviews`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('reviews'))))
      .then((d: { reviews: ReviewPreview[] }) => { cache.set(proposalId, d.reviews); if (alive) setReviews(d.reviews) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [proposalId])

  if (failed) return <p className={`text-xs text-gray-600 ${className}`}>No pudimos cargar las reseñas.</p>
  if (!reviews) return <p className={`text-xs text-gray-600 ${className}`} role="status">Cargando reseñas…</p>
  if (reviews.length === 0) return <p className={`text-xs text-gray-600 ${className}`}>Todavía no tiene reseñas de clientes.</p>
  return (
    <ul className={`space-y-2 ${className}`}>
      {reviews.map((r, i) => (
        <li key={i} className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <p className="flex items-center gap-1 font-semibold text-gray-900">
            <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden="true" />
            <span>{r.rating}</span>
            <span className="font-normal text-gray-600">· {r.reviewer}{r.service ? ` · ${r.service}` : ''}</span>
          </p>
          {r.comment && <p className="mt-0.5">{r.comment}</p>}
        </li>
      ))}
    </ul>
  )
}
