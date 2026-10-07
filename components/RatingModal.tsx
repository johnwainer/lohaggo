'use client'

import { useState, type KeyboardEvent } from 'react'
import { Calendar, Star, X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'

interface RatingModalProps {
  isOpen: boolean
  onClose: () => void
  bookingId: string
  serviceName: string
  scheduledAt?: string
  reviewType: 'client' | 'partner'
  targetName: string
  onSuccess: () => void
}

const RATING_LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente']
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

export default function RatingModal({
  isOpen,
  onClose,
  bookingId,
  serviceName,
  scheduledAt,
  reviewType,
  targetName,
  onSuccess
}: RatingModalProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { dialogProps, titleId } = useDialog(isOpen, onClose, { dismissible: !isSubmitting })

  if (!isOpen) return null

  const questionId = `${titleId}-question`
  const commentId = `${titleId}-comment`
  const errorId = `${titleId}-error`

  const pickRating = (value: number) => {
    setRating(value)
    setError(null)
  }

  // Arrow keys move the selection like a native radio group.
  const onStarKeyDown = (e: KeyboardEvent<HTMLButtonElement>, star: number) => {
    let next = star
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, star + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, star - 1)
    else return
    e.preventDefault()
    pickRating(next)
    const group = e.currentTarget.parentElement
    group?.querySelector<HTMLButtonElement>(`[data-star="${next}"]`)?.focus()
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Selecciona una calificación de 1 a 5 estrellas.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          rating,
          comment,
          reviewType
        })
      })

      if (res.ok) {
        onSuccess()
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'No pudimos enviar tu calificación. Inténtalo de nuevo.')
      }
    } catch (err) {
      console.error('Error submitting review:', err)
      setError('No pudimos enviar tu calificación. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={isSubmitting ? undefined : onClose}
      />
      <div
        {...dialogProps}
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto overscroll-contain rounded-3xl border border-primary-100 bg-white p-6 shadow-xl focus:outline-none"
      >
        <div className="mb-6 flex items-start justify-between gap-2">
          <div>
            <h3 id={titleId} className="text-xl font-bold text-gray-900">
              Calificar {reviewType === 'client' ? 'servicio' : 'cliente'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {serviceName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className={`-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 ${focusRing}`}
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Resumen del servicio</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{serviceName}</p>
          <p className="mt-1 text-xs text-gray-600">{reviewType === 'client' ? `Socio: ${targetName}` : `Cliente: ${targetName}`}</p>
          {scheduledAt && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {scheduledAt}
            </p>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p id={questionId} className="mb-3 block text-sm font-medium text-gray-700">
              ¿Cómo calificarías {reviewType === 'client' ? 'el servicio' : 'al cliente'} de {targetName}?
            </p>
            <div
              role="radiogroup"
              aria-label="Calificación"
              aria-describedby={questionId}
              className="flex justify-center gap-1"
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const checked = rating === star
                const focusable = rating === 0 ? star === 1 : checked
                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={`${star} de 5 estrellas`}
                    data-star={star}
                    tabIndex={focusable ? 0 : -1}
                    onClick={() => pickRating(star)}
                    onKeyDown={(e) => onStarKeyDown(e, star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-110 ${focusRing}`}
                  >
                    <Star
                      aria-hidden="true"
                      className={`w-10 h-10 ${
                        star <= (hoveredRating || rating)
                          ? 'fill-yellow-400 text-yellow-500'
                          : 'text-gray-500'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-gray-600 mt-2" aria-live="polite">
                {RATING_LABELS[rating]}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={commentId} className="block text-sm font-medium text-gray-700 mb-2">
              Comentario (opcional)
            </label>
            <textarea
              id={commentId}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Cuéntanos sobre tu experiencia..."
              rows={4}
              className="w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
          </div>

          {error && (
            <p id={errorId} role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`min-h-[44px] flex-1 rounded-full border border-gray-300 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 ${focusRing}`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              aria-describedby={error ? errorId : undefined}
              className={`min-h-[44px] flex-1 rounded-full bg-primary-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar calificación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
