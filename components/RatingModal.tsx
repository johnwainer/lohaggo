'use client'

import { useState } from 'react'
import { Calendar, Star, X } from 'lucide-react'

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

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Por favor selecciona una calificación')
      return
    }

    setIsSubmitting(true)

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
        const data = await res.json()
        alert(data.error || 'Error al enviar calificación')
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      alert('Error al enviar calificación')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-primary-100 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Calificar {reviewType === 'client' ? 'Servicio' : 'Cliente'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {serviceName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Resumen del servicio</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{serviceName}</p>
          <p className="mt-1 text-xs text-gray-600">{reviewType === 'client' ? `Socio: ${targetName}` : `Cliente: ${targetName}`}</p>
          {scheduledAt && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600">
              <Calendar className="h-3.5 w-3.5" />
              {scheduledAt}
            </p>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              ¿Cómo calificarías {reviewType === 'client' ? 'el servicio' : 'al cliente'} de {targetName}?
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-gray-600 mt-2">
                {rating === 1 && 'Muy malo'}
                {rating === 2 && 'Malo'}
                {rating === 3 && 'Regular'}
                {rating === 4 && 'Bueno'}
                {rating === 5 && 'Excelente'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comentario (opcional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Cuéntanos sobre tu experiencia..."
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || rating === 0}
              className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Calificación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
