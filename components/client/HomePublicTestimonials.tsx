'use client'

import { useSession } from 'next-auth/react'
import { Star } from 'lucide-react'
import { STAT_MINIMUMS } from '@/lib/public/claims'

export type HomeTestimonial = {
  rating: number
  comment: string
  author: string
  service: string
  city: string | null
}

/** Real client reviews of completed bookings; renders nothing below the minimum. */
export function HomePublicTestimonials({ testimonials }: { testimonials: HomeTestimonial[] }) {
  const { status } = useSession()

  if (status === 'loading') return null
  if (status === 'authenticated') return null
  if (testimonials.length < STAT_MINIMUMS.testimonials) return null

  return (
    <section className="py-12 bg-slate-50 border-t border-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">
          Lo que dicen nuestros clientes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.slice(0, 6).map((t, idx) => (
            <div
              key={`${t.author}-${idx}`}
              className="bg-white rounded-2xl p-6 shadow-card border border-slate-100"
            >
              <div className="flex gap-0.5 mb-3" aria-label={`${t.rating} estrellas`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.round(t.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                ))}
              </div>
              <p className="text-slate-700 text-sm mb-4 leading-relaxed">
                &ldquo;{t.comment}&rdquo;
              </p>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900">{t.author}</div>
                  <div className="text-xs text-slate-400">
                    Reseña de una reserva completada · {t.service}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
